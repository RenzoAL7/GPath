import test from 'node:test'
import assert from 'node:assert/strict'
import { createAshbyJobs, parseAshbySources } from '../server/ashby.mjs'

const payload = {
  apiVersion: '1',
  jobs: [
    {
      id: 'cloud-1',
      title: 'Cloud Infrastructure Intern',
      location: 'Santiago, Chile',
      secondaryLocations: [],
      workplaceType: 'Hybrid',
      isListed: true,
      publishedAt: '2026-09-06T00:00:00Z',
      jobUrl: 'https://jobs.ashbyhq.com/acme/cloud-1',
      descriptionPlain: 'Support AWS and Terraform infrastructure.',
    },
    {
      id: 'hidden-1',
      title: 'Cloud Engineer Intern',
      location: 'Remote',
      workplaceType: 'Remote',
      isListed: false,
      publishedAt: '2026-09-07T00:00:00Z',
      jobUrl: 'https://jobs.ashbyhq.com/acme/hidden-1',
      descriptionPlain: 'This posting is not public.',
    },
  ],
}

test('parses Ashby boards and labels', () => {
  assert.deepEqual(parseAshbySources('notion:Notion,modal'), [
    { board: 'notion', name: 'Notion' },
    { board: 'modal', name: 'modal' },
  ])
  assert.throws(() => parseAshbySources('bad board:Bad'))
})

test('reads listed Ashby postings and normalizes location and skills', async () => {
  const jobs = createAshbyJobs({
    sources: [{ board: 'acme', name: 'Acme' }],
    fetcher: async () => Response.json(payload),
  })
  const result = await jobs.read('cloud-infrastructure-intern', {
    region: 'latam',
    country: 'cl',
    workMode: 'hybrid',
  })
  assert.equal(result.mode, 'live')
  assert.equal(result.total, 1)
  assert.equal(result.sourceCount, 1)
  assert.equal(result.jobs[0].location, 'Santiago, Chile')
  assert.deepEqual(result.jobs[0].skills, ['AWS', 'Terraform'])
  assert.equal(result.jobs[0].url, payload.jobs[0].jobUrl)
})
