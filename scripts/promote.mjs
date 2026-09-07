import { readFile, writeFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseDocument } from 'yaml'

export const overlayPath = 'apps/gpath/overlays/growth'
export function renderPromotion(manifestText, applicationText, webDigest, apiDigest) {
  for (const digest of [webDigest, apiDigest]) {
    if (!/^sha256:[a-f0-9]{64}$/.test(digest))
      throw new Error('Both published image digests are required')
  }
  const manifest = parseDocument(manifestText)
  const application = parseDocument(applicationText)
  if (manifest.errors.length || application.errors.length) throw new Error('Invalid YAML')
  const images = manifest.get('images')
  for (const [name, digest] of [
    ['ghcr.io/renzoal7/gitpath', webDigest],
    ['ghcr.io/renzoal7/gitpath-api', apiDigest],
  ]) {
    const matches = images?.items?.filter((item) => item.get('name') === name) || []
    if (matches.length !== 1)
      throw new Error(
        `Expected exactly one image entry for ${name}; install the growth overlay first`,
      )
    matches[0].delete('newTag')
    matches[0].set('newName', name)
    matches[0].set('digest', digest)
  }
  if (
    application.getIn(['metadata', 'name']) !== 'gpath-prod' ||
    application.getIn(['spec', 'source', 'repoURL']) !==
      'https://github.com/RenzoAL7/K3s-Cortex.git' ||
    !['apps/gpath/overlays/prod', overlayPath].includes(
      application.getIn(['spec', 'source', 'path']),
    )
  ) {
    throw new Error('Unexpected Argo CD application; refusing to change it')
  }
  // The first promotion switches overlays only when BOTH images exist.
  application.setIn(['spec', 'source', 'path'], overlayPath)
  return { manifest: String(manifest), application: String(application) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , root, web, api] = process.argv
  if (!root)
    throw new Error('Usage: node scripts/promote.mjs CORTEX_DIRECTORY WEB_DIGEST API_DIGEST')
  const manifestPath = resolve(root, overlayPath, 'kustomization.yaml')
  const applicationPath = resolve(root, 'clusters/rnz-prod/gpath-application.yaml')
  await access(resolve(root, 'apps/gpath/api/deployment.yaml'))
  const result = renderPromotion(
    await readFile(manifestPath, 'utf8'),
    await readFile(applicationPath, 'utf8'),
    web,
    api,
  )
  await writeFile(manifestPath, result.manifest)
  await writeFile(applicationPath, result.application)
  console.log('Prepared one GitOps promotion for web + API; no cluster operations performed.')
}
