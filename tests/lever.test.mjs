import test from 'node:test'
import assert from 'node:assert/strict'
import { createLeverJobs, parseLeverSources } from '../server/lever.mjs'

const list = [
  {
    id: 'data-1',
    text: 'Data Engineer Intern',
    categories: { location: 'Ciudad de México', allLocations: ['Ciudad de México'] },
    workplaceType: 'hybrid',
    createdAt: 1780000000000,
    hostedUrl: 'https://jobs.lever.co/acme/data-1',
    descriptionPlain: 'Build data pipelines with Python and SQL.',
  },
  {
    id: 'other-1',
    text: 'Senior Data Engineer',
    categories: { location: 'Remote' },
    createdAt: 1780000000001,
    hostedUrl: 'https://jobs.lever.co/acme/other-1',
    descriptionPlain: 'Own production systems.',
  },
]

test('parses Lever sites and labels', () => {
  assert.deepEqual(parseLeverSources('palantir:Palantir,xepelin'), [
    { site: 'palantir', name: 'Palantir' },
    { site: 'xepelin', name: 'xepelin' },
  ])
  assert.throws(() => parseLeverSources('bad site:Bad'))
})

test('reads public Lever postings and applies location filters', async () => {
  const jobs = createLeverJobs({
    sources: [{ site: 'acme', name: 'Acme' }],
    fetcher: async () => Response.json(list),
  })
  const result = await jobs.read('data-engineer-intern', {
    region: 'latam',
    country: 'mx',
    workMode: 'hybrid',
  })
  assert.equal(result.mode, 'live')
  assert.equal(result.total, 1)
  assert.equal(result.sourceCount, 1)
  assert.deepEqual(result.sourceNames, ['Acme'])
  assert.equal(result.jobs[0].company, 'Acme')
  assert.equal(result.jobs[0].location, 'Ciudad de México')
  assert.deepEqual(result.jobs[0].skills, ['Python', 'SQL'])
  assert.equal(result.jobs[0].url, list[0].hostedUrl)
})
