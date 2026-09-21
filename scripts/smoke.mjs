import assert from 'node:assert/strict'
import { parseRelease } from '../shared/release.mjs'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080'
const get = (path) => fetch(base + path, { signal: AbortSignal.timeout(7000) })
assert.equal((await get('/healthz')).status, 200)
const page = await get('/')
assert.equal(page.status, 200)
assert.equal(page.headers.get('x-content-type-options'), 'nosniff')
assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/)
assert.match(await page.text(), /GPath — Analizador de ofertas/)
const frontend = await get('/release.json')
assert.equal(frontend.headers.get('cache-control'), 'no-store')
const release = parseRelease(await frontend.json())
const api = await (await get('/api/release')).json()
assert.deepEqual(release, api.release)
const probe = await (await get('/api/probe')).json()
assert.equal(probe.revision, release.revision)
assert.equal(probe.service, 'gpath-api')
const analysisResponse = await fetch(base + '/api/analyze', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  signal: AbortSignal.timeout(15_000),
  body: JSON.stringify({
    targetRole: 'data-analyst',
    profile: { level: 'junior', skills: ['Python', 'SQL'], preference: 'pe' },
    description: 'Data Analyst Junior con Python y SQL. Trabajo remoto para Perú.',
  }),
})
assert.equal(analysisResponse.status, 200)
const analysis = await analysisResponse.json()
assert.equal(analysis.compatibility.scope, 'profile')
assert.ok(Number.isInteger(analysis.compatibility.score))
assert.deepEqual(analysis.input, { type: 'text' })
console.log(
  `Smoke passed: GPath web + analyzer API, same build ${release.revision.slice(0, 7)}`,
)
