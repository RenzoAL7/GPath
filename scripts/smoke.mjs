import assert from 'node:assert/strict'
import { parseRelease } from '../shared/release.mjs'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080'
const get = (path) => fetch(base + path, { signal: AbortSignal.timeout(7000) })
assert.equal((await get('/healthz')).status, 200)
const page = await get('/')
assert.equal(page.status, 200)
assert.equal(page.headers.get('x-content-type-options'), 'nosniff')
assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/)
assert.match(await page.text(), /GPath — Growth Path/)
const frontend = await get('/release.json')
assert.equal(frontend.headers.get('cache-control'), 'no-store')
const release = parseRelease(await frontend.json())
const api = await (await get('/api/release')).json()
assert.deepEqual(release, api.release)
const probe = await (await get('/api/probe')).json()
assert.equal(probe.revision, release.revision)
assert.equal(probe.service, 'gpath-api')
const jobs = await (await get('/api/jobs?role=data')).json()
if (jobs.mode === 'demo') {
  assert.equal(jobs.total, 4)
  assert.equal(jobs.skills.find((skill) => skill.name === 'Python').count, 4)
} else {
  assert.equal(jobs.mode, 'live')
  assert.match(jobs.collectedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.ok(Array.isArray(jobs.sourceNames))
  assert.ok(jobs.jobs.every((job) => /^https:\/\//.test(job.url)))
}
console.log(
  `Smoke passed: Growth Path web + API, same build ${release.revision.slice(0, 7)}, mode=${jobs.mode}`,
)
