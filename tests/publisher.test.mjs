import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { publishArchive } from '../scripts/publish-archive.mjs'

const metadata = {
  schemaVersion: 1,
  version: '0.2.0',
  revision: 'a'.repeat(40),
  builtAt: '2026-09-04T00:00:00Z',
  dirty: false,
  runId: '123',
}
const options = { metadata, bucket: 'test-bucket', namespace: 'test-namespace' }
function fakeCli({ missing = false, conflict = false } = {}) {
  const calls = []
  const objects = new Map([
    ['gpath/releases/index.json', JSON.stringify({ schemaVersion: 1, releases: [] })],
  ])
  return {
    calls,
    objects,
    executor(command, args) {
      assert.equal(command, 'oci')
      const operation = args[2]
      const value = (key) => args[args.indexOf(key) + 1]
      const name = value('--name')
      calls.push({ operation, name, args })
      if (operation === 'head') {
        if (missing) throw new Error('sensitive upstream error')
        return JSON.stringify({ etag: 'etag-before', 'content-length': '36' })
      }
      if (operation === 'get') {
        assert.equal(value('--if-match'), 'etag-before')
        writeFileSync(value('--file'), objects.get(name))
      } else if (operation === 'put') {
        if (name.endsWith('/index.json')) {
          assert.equal(value('--if-match'), 'etag-before')
          assert.ok(args.includes('--force'))
          if (conflict) throw new Error('precondition failed; private upstream URL')
        } else {
          assert.ok(args.includes('--no-overwrite'))
          assert.match(name, /^gpath\/releases\/[a-f0-9]{40}-123-[a-f0-9]{64}\.json$/)
        }
        objects.set(name, readFileSync(value('--file'), 'utf8'))
      }
      return '{}'
    },
  }
}
test('publisher only writes its prefix and uses ETag preconditions; replays are idempotent', async () => {
  const fake = fakeCli()
  await publishArchive({ ...options, executor: fake.executor })
  await publishArchive({ ...options, executor: fake.executor })
  assert.equal(fake.objects.size, 2)
  assert.equal(JSON.parse(fake.objects.get('gpath/releases/index.json')).releases.length, 1)
  assert.ok(fake.calls.every((call) => call.name.startsWith('gpath/releases/')))
  assert.ok(fake.calls.every((call) => call.operation !== 'delete'))
})
test('publisher fails closed on unreadable index and does not overwrite concurrent catalog changes', async () => {
  const missing = fakeCli({ missing: true })
  await assert.rejects(
    publishArchive({ ...options, executor: missing.executor }),
    /OCI head failed/,
  )
  assert.equal(missing.calls.length, 1)
  const conflict = fakeCli({ conflict: true })
  await assert.rejects(
    publishArchive({ ...options, executor: conflict.executor }),
    /OCI put failed/,
  )
  assert.equal(JSON.parse(conflict.objects.get('gpath/releases/index.json')).releases.length, 0)
})
test('publisher rejects local or dirty builds before making any cloud calls', async () => {
  for (const change of [{ dirty: true }, { runId: null }, { revision: 'local' }]) {
    const fake = fakeCli()
    await assert.rejects(
      publishArchive({ ...options, metadata: { ...metadata, ...change }, executor: fake.executor }),
      /Archive only/,
    )
    assert.equal(fake.calls.length, 0)
  }
})
