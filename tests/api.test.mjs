import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createApi } from '../server/app.mjs'
import { roles } from '../server/jobs.mjs'

const release = {
  schemaVersion: 1,
  version: '0.2.0',
  revision: 'a'.repeat(40),
  builtAt: '2026-09-04T00:00:00.000Z',
  dirty: false,
  runId: '12345',
}
async function fixture(t, options = {}) {
  const logs = []
  const server = createApi({ release, log: (entry) => logs.push(entry), ...options })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeAllConnections()
      }),
  )
  return { url: `http://127.0.0.1:${server.address().port}`, logs }
}

const analyzerResponse = {
  input: {
    type: 'url',
    originalUrl: 'https://jobs.example.test/data-analyst?token=private-offer-token',
  },
  offer: { title: 'Data Analyst' },
  targetRole: { id: 'data-analyst', label: 'Data Analyst' },
  compatibility: {
    score: 83,
    label: 'Alta compatibilidad',
    recommendation: 'Vale la pena postular',
    scope: 'profile',
  },
  factors: [
    {
      id: 'technical-skills',
      label: 'Habilidades técnicas coincidentes',
      score: 75,
      weight: 50,
      contribution: 37.5,
      detail: '3 de 4 habilidades requeridas',
      available: true,
    },
  ],
  requirements: {
    technical: ['Python', 'SQL', 'Airflow', 'Docker'],
    preferred: [],
    level: 'Junior',
    location: 'Lima, Perú',
    workMode: 'onsite',
    salary: null,
  },
  profile: { provided: true, matched: ['Python', 'SQL', 'Docker'], gaps: ['Airflow'] },
  evidence: [{ label: 'Tecnologías', text: 'Python, SQL, Airflow y Docker' }],
  explanation: 'Tu perfil coincide con tres habilidades mencionadas en la oferta.',
  limitations: ['El resultado es orientativo y depende del contenido público disponible.'],
}

function analysisRequest(overrides = {}) {
  return {
    targetRole: 'data-analyst',
    profile: { level: 'junior', skills: ['Python', 'SQL', 'Docker'] },
    url: 'https://jobs.example.test/data-analyst?token=private-offer-token',
    ...overrides,
  }
}

async function analyze(url, body, headers = { 'content-type': 'application/json' }) {
  return fetch(url + '/api/analyze', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

test('health and readiness are independent from OCI', async (t) => {
  const { url } = await fixture(t, {
    archive: {
      read() {
        throw new Error('upstream secret')
      },
    },
  })
  for (const path of ['/healthz', '/readyz']) assert.equal((await fetch(url + path)).status, 200)
  const response = await fetch(url + '/api/releases')
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), /upstream secret/)
})

test('release and probe report real runtime metadata, unique IDs and no user data', async (t) => {
  const { url, logs } = await fixture(t)
  const metadata = await (await fetch(url + '/api/release')).json()
  assert.equal(metadata.release.revision, release.revision)
  assert.equal(metadata.environment, 'local')
  const response = await fetch(url + '/api/probe?private=do-not-log', {
    headers: { authorization: 'secret' },
  })
  const probe = await response.json()
  const second = await (await fetch(url + '/api/probe')).json()
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('x-request-id'), probe.requestId)
  assert.notEqual(probe.requestId, second.requestId)
  assert.ok(Math.abs(Date.now() - Date.parse(probe.receivedAt)) < 5000)
  assert.equal(probe.revision, release.revision)
  assert.ok(probe.uptimeSeconds >= 0)
  assert.doesNotMatch(JSON.stringify(logs), /secret|private|authorization|127\.0\.0\.1/)
})

test('read-only routes, HEAD, explicit missing archive and 404', async (t) => {
  const { url } = await fixture(t)
  assert.equal((await fetch(url + '/api/probe', { method: 'POST', body: 'data' })).status, 405)
  assert.equal((await fetch(url + '/unknown')).status, 404)
  const head = await fetch(url + '/api/release', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  const catalog = await (await fetch(url + '/api/releases')).json()
  assert.equal(catalog.status, 'not-configured')
  assert.deepEqual(catalog.releases, [])
})

test('jobs endpoint validates roles, filters and calculated demo data', async (t) => {
  const { url } = await fixture(t)
  for (const role of Object.keys(roles)) {
    const response = await fetch(`${url}/api/jobs?role=${role}`)
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.role, role)
    assert.equal(result.mode, 'demo')
    assert.equal(result.total, result.jobs.length)
    assert.deepEqual(result.filters, { region: 'all', country: 'all', workMode: 'all' })
  }
  const peru = await (
    await fetch(url + '/api/jobs?role=backend-intern&region=latam&country=pe&workMode=onsite')
  ).json()
  assert.equal(peru.total, 1)
  assert.equal(peru.jobs[0].country, 'pe')
  assert.deepEqual(peru.filters, { region: 'latam', country: 'pe', workMode: 'onsite' })

  const remote = await (
    await fetch(url + '/api/jobs?role=data-intern&region=latam&country=all&workMode=remote')
  ).json()
  assert.equal(remote.total, 1)
  assert.equal(remote.jobs[0].location, 'Remoto · LATAM')

  const unknown = await (
    await fetch(url + '/api/jobs?role=data-intern&region=latam&country=unknown&workMode=all')
  ).json()
  assert.equal(unknown.total, 0)

  assert.equal((await fetch(url + '/api/jobs?role=__proto__')).status, 400)
  assert.equal((await fetch(url + '/api/jobs?role=data-intern&region=global')).status, 400)
  assert.equal((await fetch(url + '/api/jobs', { method: 'POST' })).status, 405)
})

test('jobs endpoint can serve a live provider and hides provider failures', async (t) => {
  const live = {
    role: 'data-intern',
    label: 'Data Intern',
    mode: 'live',
    collectedAt: '2026-09-07T00:00:00.000Z',
    total: 1,
    filters: { region: 'all', country: 'all', workMode: 'all' },
    skills: [],
    jobs: [],
  }
  const { url } = await fixture(t, { jobs: { read: async () => live } })
  const response = await fetch(url + '/api/jobs?role=data-intern')
  assert.equal(response.status, 200)
  assert.equal((await response.json()).mode, 'live')

  const failed = await fixture(t, {
    jobs: {
      read: async () => {
        throw new Error('provider secret')
      },
    },
  })
  const failure = await fetch(failed.url + '/api/jobs?role=data-intern')
  assert.equal(failure.status, 502)
  assert.deepEqual(await failure.json(), {
    error: 'No se pudieron consultar las ofertas públicas. Inténtalo de nuevo.',
  })
})

test('analysis endpoint forwards either one URL or one manual description without logging private input', async (t) => {
  const received = []
  const { url, logs } = await fixture(t, {
    analyzer: {
      analyze: async (input) => {
        received.push(input)
        if (input.description) {
          return {
            ...analyzerResponse,
            input: { type: 'text' },
            compatibility: { ...analyzerResponse.compatibility, scope: 'target' },
            profile: { provided: false, matched: [], gaps: [] },
          }
        }
        return analyzerResponse
      },
    },
  })

  const request = analysisRequest()
  const response = await analyze(url, request)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), analyzerResponse)

  const description = 'Descripción privada: Python y SQL. No registrar este texto.'
  const textRequest = analysisRequest({
    url: undefined,
    description,
    profile: { level: 'junior', skills: [] },
  })
  const { url: omittedUrl, ...manualInput } = textRequest
  const textResponse = await analyze(url, textRequest)
  assert.equal(textResponse.status, 200)
  assert.deepEqual(await textResponse.json(), {
    ...analyzerResponse,
    input: { type: 'text' },
    compatibility: { ...analyzerResponse.compatibility, scope: 'target' },
    profile: { provided: false, matched: [], gaps: [] },
  })

  assert.deepEqual(received, [request, manualInput])
  const logged = JSON.stringify(logs)
  assert.doesNotMatch(logged, /private-offer-token|Descripción privada|No registrar este texto/)
})

test('analysis endpoint rejects invalid XOR input and profile values before invoking the analyzer', async (t) => {
  let calls = 0
  const { url } = await fixture(t, {
    analyzer: {
      analyze: async () => {
        calls++
        return analyzerResponse
      },
    },
  })
  const invalidBodies = [
    analysisRequest({ url: undefined }),
    analysisRequest({ description: 'Pegar ambos no es válido.' }),
    analysisRequest({ url: 'not-a-public-url' }),
    analysisRequest({ url: ' ' }),
    analysisRequest({ url: undefined, description: '   ' }),
    analysisRequest({ targetRole: 'senior-data-scientist' }),
    analysisRequest({ profile: { level: 'senior', skills: [], preference: 'pe' } }),
    analysisRequest({ profile: { level: 'junior', skills: [], preference: 'worldwide' } }),
    analysisRequest({ profile: { level: 'junior', skills: ['Python', 7], preference: 'pe' } }),
  ]

  for (const body of invalidBodies) {
    const response = await analyze(url, body)
    assert.equal(response.status, 400)
    const payload = await response.json()
    assert.equal(typeof payload.error, 'string')
  }
  assert.equal(calls, 0)
})

test('analysis endpoint requires JSON before accepting any analyzer input', async (t) => {
  let calls = 0
  const { url } = await fixture(t, {
    analyzer: {
      analyze: async () => {
        calls++
        return analyzerResponse
      },
    },
  })
  const response = await analyze(url, JSON.stringify(analysisRequest()), {
    'content-type': 'text/plain',
  })
  assert.equal(response.status, 415)
  const payload = await response.json()
  assert.equal(typeof payload.error, 'string')
  assert.equal(calls, 0)
})
