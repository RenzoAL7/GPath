import test from 'node:test'
import assert from 'node:assert/strict'
import { createArchive } from '../server/archive.mjs'

const url =
  'https://objectstorage.us-ashburn-1.oraclecloud.com/p/test-secret/n/test/b/test/o/gpath/releases/index.json'
const catalog = {
  schemaVersion: 1,
  releases: [
    {
      schemaVersion: 1,
      version: '0.2.0',
      revision: 'a'.repeat(40),
      builtAt: '2026-09-04T00:00:00Z',
      dirty: false,
      runId: '123',
    },
  ],
}
test('requires a fixed HTTPS OCI origin, rejecting arbitrary hosts and credentials', () => {
  for (const target of [
    'http://127.0.0.1',
    'https://example.com',
    'https://objectstorage.us-ashburn-1.oraclecloud.com.evil.com',
    'https://user@objectstorage.us-ashburn-1.oraclecloud.com',
    'https://objectstorage.us-ashburn-1.oraclecloud.com:8443',
  ]) {
    assert.throws(() => createArchive({ url: target }))
  }
})
test('deduplicates concurrent fetches and caches successful reads', async () => {
  let calls = 0
  const archive = createArchive({
    url,
    fetcher: async (_, options) => {
      calls++
      assert.equal(options.redirect, 'error')
      assert.ok(options.signal)
      return Response.json(catalog)
    },
  })
  const results = await Promise.all([archive.read(), archive.read(), archive.read()])
  assert.equal(calls, 1)
  assert.equal(results[0].status, 'connected')
  await archive.read()
  assert.equal(calls, 1)
  assert.doesNotMatch(JSON.stringify(results), /test-secret/)
})
test('shows stale data after failure and retries after the cache TTL', async () => {
  let now = 1000,
    fail = false
  const archive = createArchive({
    url,
    clock: () => now,
    ttl: 100,
    fetcher: async () => {
      if (fail) throw new Error(url)
      return Response.json(catalog)
    },
  })
  assert.equal((await archive.read()).status, 'connected')
  now += 101
  fail = true
  const stale = await archive.read()
  assert.equal(stale.status, 'stale')
  assert.equal(stale.releases.length, 1)
  assert.equal(stale.fetchedAt, new Date(1000).toISOString())
  now += 101
  fail = false
  assert.equal((await archive.read()).status, 'connected')
})
test('bad, failed and oversized responses degrade without exposing the upstream', async () => {
  for (const result of [
    new Response('x', { status: 403 }),
    new Response('invalid json'),
    Response.json({ schemaVersion: 2 }),
    new Response('x'.repeat(131073)),
  ]) {
    const archive = createArchive({ url, fetcher: async () => result })
    assert.deepEqual(await archive.read(), {
      schemaVersion: 1,
      releases: [],
      status: 'unavailable',
      fetchedAt: null,
    })
  }
})
