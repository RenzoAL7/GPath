import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeJobs, demoAnalysis } from '../server/jobs.mjs'
test('demo is explicitly fictitious and each role has its own sample', () => {
  for (const role of ['data', 'backend', 'devops']) {
    const result = demoAnalysis(role)
    assert.equal(result.mode, 'demo')
    assert.equal(result.collectedAt, null)
    assert.equal(result.total, 4)
    assert.ok(result.jobs.every((job) => job.role === role))
    for (const skill of result.skills)
      assert.equal(skill.percent, (skill.count / result.total) * 100)
  }
})
test('deduplicate jobs and count repeated skills once; NoSQL is not SQL', () => {
  const job = { id: 'one', role: 'data', description: 'Python python NoSQL' }
  const result = analyzeJobs('data', [job, job])
  assert.equal(result.total, 1)
  assert.deepEqual(result.skills, [{ name: 'Python', count: 1, percent: 100 }])
})
test('unknown roles are rejected and empty samples do not divide by zero', () => {
  assert.throws(() => analyzeJobs('invalid'), RangeError)
  assert.deepEqual(analyzeJobs('backend', []).skills, [])
})
