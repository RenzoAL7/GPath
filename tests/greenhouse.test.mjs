import test from 'node:test'
import assert from 'node:assert/strict'
import { createGreenhouseJobs, parseGreenhouseSources } from '../server/greenhouse.mjs'

const sources = [{ token: 'acme', name: 'Acme' }]
const list = {
  jobs: [
    {
      id: 101,
      title: 'Data Engineer',
      absolute_url: 'https://acme.example/jobs/101',
      updated_at: '2026-09-06T00:00:00Z',
      location: { name: 'Remote' },
    },
    {
      id: 102,
      title: 'Product Designer',
      absolute_url: 'https://acme.example/jobs/102',
      updated_at: '2026-09-05T00:00:00Z',
      location: { name: 'Lima' },
    },
  ],
}
const detail = {
  id: 101,
  title: 'Data Engineer',
  company_name: 'Acme',
  absolute_url: 'https://acme.example/jobs/101',
  updated_at: '2026-09-06T00:00:00Z',
  location: { name: 'Remote' },
  content: '&lt;p&gt;Build pipelines with &lt;strong&gt;Python&lt;/strong&gt; and SQL.&lt;/p&gt;',
}

test('parses a small, explicit list of public Greenhouse boards', () => {
  assert.deepEqual(parseGreenhouseSources('stripe:Stripe,vercel'), [
    { token: 'stripe', name: 'Stripe' },
    { token: 'vercel', name: 'vercel' },
  ])
  assert.throws(() => parseGreenhouseSources('bad_token:Bad'))
})

test('fetches matching posts, strips HTML, analyzes skills and caches the result', async () => {
  let calls = 0
  const jobs = createGreenhouseJobs({
    sources,
    ttl: 60_000,
    fetcher: async (url) => {
      calls++
      if (url.endsWith('/jobs')) return Response.json(list)
      return Response.json(detail)
    },
  })
  const first = await jobs.read('data')
  const second = await jobs.read('data')
  assert.equal(first.mode, 'live')
  assert.equal(first.total, 1)
  assert.equal(first.sourceCount, 1)
  assert.deepEqual(first.sourceNames, ['Acme'])
  assert.deepEqual(first.jobs[0].skills, ['Python', 'SQL'])
  assert.equal(first.jobs[0].description, 'Build pipelines with Python and SQL.')
  assert.equal(first.jobs[0].url, detail.absolute_url)
  assert.equal(second.collectedAt, first.collectedAt)
  assert.equal(calls, 2)
})
