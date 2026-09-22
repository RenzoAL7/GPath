import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRelease } from '../shared/release.mjs'

export const release = {
  schemaVersion: 1,
  version: '0.2.0',
  revision: 'a'.repeat(40),
  builtAt: '2026-09-04T00:00:00.000Z',
  dirty: false,
  runId: '12345',
}
test('metadata constructs trusted evidence links and strips extra fields', () => {
  const value = parseRelease({ ...release, sourceUrl: 'javascript:alert(1)', secret: 'not public' })
  assert.equal(value.sourceUrl, `https://github.com/RenzoAL7/Gitpath/commit/${release.revision}`)
  assert.equal(value.runUrl, 'https://github.com/RenzoAL7/Gitpath/actions/runs/12345')
  assert.equal(value.secret, undefined)
})
test('invalid metadata is rejected', () => {
  for (const field of [
    { revision: '../secret' },
    { version: 1 },
    { builtAt: 'never' },
    { runId: 123 },
    { dirty: 'false' },
    { schemaVersion: 2 },
  ]) {
    assert.throws(() => parseRelease({ ...release, ...field }))
  }
})
