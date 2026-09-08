import test from 'node:test'
import assert from 'node:assert/strict'
import { createMultiSourceJobs } from '../server/multi-source.mjs'

const job = {
  id: 'one',
  role: 'data-engineer-intern',
  company: 'Acme',
  title: 'Data Engineer Intern',
  location: 'Remote · LATAM',
  region: 'latam',
  country: null,
  city: null,
  workMode: 'remote',
  description: 'Build pipelines with Python.',
  skills: [],
  url: 'https://jobs.example/data-engineer-intern',
  source: 'Acme',
  updatedAt: '2026-09-06T00:00:00Z',
}

test('merges successful providers and marks partial failures', async () => {
  const jobs = createMultiSourceJobs({
    providers: [
      {
        read: async () => ({
          jobs: [job],
          sourceNames: ['Greenhouse board'],
          partial: false,
        }),
      },
      { read: async () => Promise.reject(new Error('provider unavailable')) },
    ],
  })
  const result = await jobs.read('data-engineer-intern')
  assert.equal(result.mode, 'live')
  assert.equal(result.total, 1)
  assert.equal(result.sourceCount, 1)
  assert.deepEqual(result.sourceNames, ['Greenhouse board'])
  assert.equal(result.partial, true)
})

test('fails when every provider is unavailable', async () => {
  const jobs = createMultiSourceJobs({
    providers: [{ read: async () => Promise.reject(new Error('down')) }],
  })
  await assert.rejects(() => jobs.read('data-engineer-intern'))
})

test('does not cache a partial response', async () => {
  let calls = 0
  const jobs = createMultiSourceJobs({
    providers: [
      {
        read: async () => {
          calls++
          return calls === 1
            ? { jobs: [], sourceNames: [], partial: true }
            : { jobs: [job], sourceNames: ['Acme'], partial: false }
        },
      },
    ],
  })
  const first = await jobs.read('data-engineer-intern')
  const second = await jobs.read('data-engineer-intern')
  assert.equal(first.total, 0)
  assert.equal(first.partial, true)
  assert.equal(second.total, 1)
  assert.equal(calls, 2)
})
