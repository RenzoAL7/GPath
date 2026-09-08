import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeJobs, demoAnalysis, matchesRole, roles } from '../server/jobs.mjs'
import { demoJobs } from '../server/demo-jobs.mjs'

test('demo includes six entry-level roles and four examples per role', () => {
  for (const role of Object.keys(roles)) {
    const result = demoAnalysis(role)
    assert.equal(result.mode, 'demo')
    assert.equal(result.collectedAt, null)
    assert.equal(result.total, 4)
    assert.ok(result.jobs.every((job) => job.role === role))
    assert.ok(result.jobs.every((job) => /intern|practicante|internship/i.test(job.title)))
    for (const skill of result.skills)
      assert.equal(skill.percent, Math.round((skill.count / result.total) * 100))
  }
})

test('location filters recalculate the result and do not fall back to global data', () => {
  assert.equal(
    analyzeJobs('data-intern', demoJobs, {
      region: 'latam',
      country: 'pe',
      workMode: 'onsite',
    }).total,
    1,
  )
  assert.equal(
    analyzeJobs('data-intern', demoJobs, {
      region: 'latam',
      country: 'all',
      workMode: 'remote',
    }).total,
    1,
  )
  assert.equal(
    analyzeJobs('data-intern', demoJobs, {
      region: 'all',
      country: 'unknown',
      workMode: 'all',
    }).total,
    1,
  )
  assert.equal(
    analyzeJobs('data-intern', demoJobs, {
      region: 'latam',
      country: 'unknown',
      workMode: 'all',
    }).total,
    0,
  )
})

test('deduplicate jobs and count repeated skills once; NoSQL is not SQL', () => {
  const job = { id: 'one', role: 'data-intern', description: 'Python python NoSQL' }
  const result = analyzeJobs('data-intern', [job, job])
  assert.equal(result.total, 1)
  assert.deepEqual(result.skills, [{ name: 'Python', count: 1, percent: 100 }])
})

test('unknown roles and filters are rejected; empty samples do not divide by zero', () => {
  assert.throws(() => analyzeJobs('invalid'), RangeError)
  assert.throws(() => analyzeJobs('data-intern', demoJobs, { region: 'global' }), RangeError)
  assert.deepEqual(analyzeJobs('backend-intern', []).skills, [])
})

test('live role matching only accepts entry-level titles', () => {
  assert.equal(matchesRole('data-intern', 'Data Intern'), true)
  assert.equal(matchesRole('data-intern', 'Data Internship'), true)
  assert.equal(matchesRole('data-intern', 'Senior Data Engineer'), false)
  assert.equal(matchesRole('qa-intern', 'QA Automation Intern'), true)
})
