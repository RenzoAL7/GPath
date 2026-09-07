import test from 'node:test'
import assert from 'node:assert/strict'
import { parse } from 'yaml'
import { renderPromotion, overlayPath } from '../scripts/promote.mjs'

const manifest = `images:
  - name: ghcr.io/renzoal7/gitpath
    newTag: release-not-published
  - name: ghcr.io/renzoal7/gitpath-api
    newTag: release-not-published
  - name: another-app
    newTag: keep-me
`
const application = `metadata:
  name: gpath-prod
spec:
  source:
    repoURL: https://github.com/RenzoAL7/K3s-Cortex.git
    path: apps/gpath/overlays/prod
`
const web = `sha256:${'a'.repeat(64)}`,
  api = `sha256:${'b'.repeat(64)}`
test('promotes both immutable images and switches the app in one PR without touching other images', () => {
  const result = renderPromotion(manifest, application, web, api)
  const images = parse(result.manifest).images
  assert.equal(images[0].digest, web)
  assert.equal(images[1].digest, api)
  assert.equal(images[0].newTag, undefined)
  assert.equal(images[2].newTag, 'keep-me')
  assert.equal(parse(result.application).spec.source.path, overlayPath)
  assert.deepEqual(renderPromotion(result.manifest, result.application, web, api), result)
})
test('refuses partial, ambiguous, malformed or unrelated promotions', () => {
  assert.throws(() => renderPromotion(manifest, application, web, 'latest'))
  assert.throws(() =>
    renderPromotion(manifest.replace('gitpath-api', 'wrong-image'), application, web, api),
  )
  assert.throws(() =>
    renderPromotion(
      manifest.replace('another-app', 'ghcr.io/renzoal7/gitpath'),
      application,
      web,
      api,
    ),
  )
  assert.throws(() =>
    renderPromotion(manifest, application.replace('gpath-prod', 'other-prod'), web, api),
  )
  assert.throws(() =>
    renderPromotion(manifest, application.replace('overlays/prod', 'overlays/unknown'), web, api),
  )
})
