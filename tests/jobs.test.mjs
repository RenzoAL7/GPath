import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeJobs, demoAnalysis, matchesRole, roleFamilies, roles } from '../server/jobs.mjs'
import { demoJobs } from '../server/demo-jobs.mjs'

test('demo includes role families and specific entry-level roles', () => {
  assert.equal(Object.keys(roles).length, 26)
  for (const role of Object.keys(roles)) {
    const result = demoAnalysis(role)
    assert.equal(result.mode, 'demo')
    assert.equal(result.collectedAt, null)
    assert.equal(result.total, 4)
    assert.ok(result.jobs.every((job) => job.role === roleFamilies[role] || job.role === role))
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
  const specificRoles = [
    ['data-engineer-intern', 'Data Engineer Intern'],
    ['data-engineering-intern', 'Data Engineering Intern'],
    ['data-infrastructure-intern', 'Data Infrastructure Intern'],
    ['data-platform-intern', 'Data Platform Intern'],
    ['cloud-engineer-intern', 'Cloud Engineer Intern'],
    ['cloud-infrastructure-intern', 'Cloud Infrastructure Intern'],
    ['platform-engineer-intern', 'Platform Engineer Intern'],
    ['infrastructure-engineer-intern', 'Infrastructure Engineer Intern'],
    ['mlops-intern', 'MLOps Intern'],
    ['machine-learning-engineer-intern', 'Machine Learning Engineer Intern'],
    ['ml-engineer-intern', 'ML Engineer Intern'],
    ['ai-engineer-intern', 'AI Engineer Intern'],
    ['software-engineer-intern-data', 'Software Engineer Intern Data'],
    ['software-engineer-intern-infrastructure', 'Software Engineer Intern Infrastructure'],
    ['software-engineer-intern-backend', 'Software Engineer Intern Backend'],
    ['sre-intern', 'SRE Intern'],
    ['site-reliability-engineer-intern', 'Site Reliability Engineer Intern'],
    ['big-data-intern', 'Big Data Intern'],
    ['analytics-engineer-intern', 'Analytics Engineer Intern'],
    ['dataops-intern', 'DataOps Intern'],
  ]
  for (const [role, title] of specificRoles) assert.equal(matchesRole(role, title), true)
  assert.equal(matchesRole('data-engineer-intern', 'Senior Data Engineer'), false)
})
