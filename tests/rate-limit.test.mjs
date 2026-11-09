import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { createApi } from '../server/app.mjs'
import { requestOnce } from '../server/public-offer.mjs'
import {
  clientAddress,
  clientKey,
  createAnalysisLimits,
  createConcurrencyLimiter,
  createRateLimiter,
  parseAnalysisLimits,
} from '../server/rate-limit.mjs'

const release = {
  schemaVersion: 1,
  version: '0.2.0',
  revision: 'a'.repeat(40),
  builtAt: '2026-09-04T00:00:00.000Z',
  dirty: false,
  runId: '12345',
}

async function api(t, options) {
  const logs = []
  const server = createApi({ release, log: (entry) => logs.push(entry), ...options })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => {
    server.close()
    server.closeAllConnections()
  })
  return { url: `http://127.0.0.1:${server.address().port}`, logs }
}

function analyze(url, headers = {}) {
  return fetch(`${url}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      targetRole: 'other',
      profile: { level: 'junior', skills: [] },
      description: 'Buscamos Data Analyst Junior con Python y SQL para trabajo remoto en Perú.',
    }),
  })
}

test('the limiter blocks over the limit and recovers when the window ends', () => {
  let clock = 0
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, now: () => clock })
  assert.equal(limiter.check('a').allowed, true)
  assert.equal(limiter.check('a').allowed, true)
  const blocked = limiter.check('a')
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.retryAfterSeconds, 1)
  assert.equal(limiter.check('b').allowed, true)
  clock = 1000
  assert.equal(limiter.check('a').allowed, true)
})

test('rotating client identifiers cannot grow the limiter without bound', () => {
  const limiter = createRateLimiter({ max: 1, maxKeys: 50, now: () => 0 })
  for (let index = 0; index < 500; index++) limiter.check(`client-${index}`)
  assert.ok(limiter.size <= 50)
})

test('the concurrency limiter frees a slot once, even if released twice', () => {
  const limiter = createConcurrencyLimiter(1)
  const release = limiter.tryAcquire()
  assert.equal(limiter.tryAcquire(), null)
  release()
  release()
  assert.equal(limiter.active, 0)
  assert.ok(limiter.tryAcquire())
})

test('client keys group an IPv6 subscriber and unwrap mapped IPv4', () => {
  assert.equal(clientKey('203.0.113.9'), '203.0.113.9')
  assert.equal(clientKey('::ffff:203.0.113.9'), '203.0.113.9')
  assert.equal(clientKey('::ffff:cb00:7109'), '203.0.113.9')
  assert.equal(clientKey('2001:db8:1:2:aaaa::1'), clientKey('2001:db8:1:2:bbbb::2'))
  assert.notEqual(clientKey('2001:db8:1:2::1'), clientKey('2001:db8:1:3::1'))
})

test('the proxy header is used only when configured and valid', () => {
  const req = (value) => ({
    headers: { 'cf-connecting-ip': value },
    socket: { remoteAddress: '10.0.0.5' },
  })
  assert.equal(clientAddress(req('203.0.113.9')), '10.0.0.5')
  assert.equal(clientAddress(req('203.0.113.9'), 'cf-connecting-ip'), '203.0.113.9')
  assert.equal(clientAddress(req('not-an-ip'), 'cf-connecting-ip'), '10.0.0.5')
})

test('limit settings reject invalid values instead of silently disabling limits', () => {
  assert.deepEqual(parseAnalysisLimits({}), {
    perClient: 10,
    global: 120,
    concurrent: 8,
    clientIpHeader: '',
  })
  assert.throws(() => parseAnalysisLimits({ ANALYZE_RATE_PER_MINUTE: '0' }))
  assert.throws(() => parseAnalysisLimits({ ANALYZE_MAX_CONCURRENT: 'muchos' }))
  assert.throws(() => parseAnalysisLimits({ CLIENT_IP_HEADER: 'bad header' }))
})

test('a client over its limit gets 429 in Spanish, without its IP in the logs', async (t) => {
  let analyzed = 0
  const { url, logs } = await api(t, {
    analyzer: { analyze: async () => ((analyzed += 1), { ok: true }) },
    limits: createAnalysisLimits({ perClient: 2 }),
  })
  assert.equal((await analyze(url)).status, 200)
  assert.equal((await analyze(url)).status, 200)
  const blocked = await analyze(url)
  assert.equal(blocked.status, 429)
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1)
  assert.match((await blocked.json()).error, /Espera \d+ segundos/)
  assert.equal(analyzed, 2)
  assert.equal(logs.at(-1).limited, 'client')
  assert.doesNotMatch(JSON.stringify(logs), /127\.0\.0\.1/)
})

test('one client over its limit does not spend the shared quota or block others', async (t) => {
  const { url } = await api(t, {
    analyzer: { analyze: async () => ({ ok: true }) },
    limits: createAnalysisLimits({
      perClient: 1,
      global: 3,
      clientIpHeader: 'cf-connecting-ip',
    }),
  })
  const attacker = { 'CF-Connecting-IP': '203.0.113.1' }
  assert.equal((await analyze(url, attacker)).status, 200)
  for (let index = 0; index < 5; index++) assert.equal((await analyze(url, attacker)).status, 429)
  assert.equal((await analyze(url, { 'CF-Connecting-IP': '203.0.113.2' })).status, 200)
  assert.equal((await analyze(url, { 'CF-Connecting-IP': '203.0.113.3' })).status, 200)
  const overGlobal = await analyze(url, { 'CF-Connecting-IP': '203.0.113.4' })
  assert.equal(overGlobal.status, 429)
  assert.match((await overGlobal.json()).error, /muchas personas/)
})

test('too many simultaneous analyses get 503 and the slot is freed afterwards', async (t) => {
  let finish
  const held = new Promise((resolve) => (finish = resolve))
  const { url } = await api(t, {
    analyzer: { analyze: async () => (await held, { ok: true }) },
    limits: createAnalysisLimits({ concurrent: 1 }),
  })
  const first = analyze(url)
  await new Promise((resolve) => setTimeout(resolve, 50))
  const second = await analyze(url)
  assert.equal(second.status, 503)
  assert.equal(second.headers.get('retry-after'), '5')
  finish()
  assert.equal((await first).status, 200)
  assert.equal((await analyze(url)).status, 200)
})

test('a failed analysis also frees its slot', async (t) => {
  const { url } = await api(t, {
    analyzer: {
      analyze: async () => {
        throw new Error('fallo')
      },
    },
    limits: createAnalysisLimits({ concurrent: 1 }),
  })
  assert.equal((await analyze(url)).status, 503)
  assert.equal((await analyze(url)).status, 503)
  const body = await (await analyze(url)).json()
  assert.match(body.error, /No se pudo completar/)
})

test('other routes are not rate limited', async (t) => {
  const { url } = await api(t, { limits: createAnalysisLimits({ perClient: 1 }) })
  for (let index = 0; index < 5; index++) assert.equal((await fetch(`${url}/healthz`)).status, 200)
})

test('a site that drips bytes cannot outlast the total read deadline', async (t) => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    const drip = setInterval(() => res.write('x'), 20)
    res.on('close', () => clearInterval(drip))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => {
    server.close()
    server.closeAllConnections()
  })
  const started = performance.now()
  await assert.rejects(
    requestOnce(
      new URL(`http://127.0.0.1:${server.address().port}/`),
      { address: '127.0.0.1', family: 4 },
      { timeout: 5000, totalTimeout: 200 },
    ),
    (error) => error.code === 'timeout' && error.status === 504,
  )
  assert.ok(performance.now() - started < 2000)
})
