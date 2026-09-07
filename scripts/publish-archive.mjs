import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseRelease, mergeCatalog } from '../shared/release.mjs'

// Explicit, optional operation. Never called by the API or by npm run build.
export async function publishArchive({ metadata, bucket, namespace, executor = execFileSync }) {
  const release = parseRelease(metadata)
  if (release.dirty || release.revision === 'local' || !release.runId) {
    throw new Error('Archive only a clean CI release.json downloaded from a successful workflow')
  }
  if (!bucket || !namespace)
    throw new Error('Set OCI_RELEASE_BUCKET and OCI_RELEASE_NAMESPACE in .env.local')
  const common = ['--bucket-name', bucket, '--namespace-name', namespace]
  function oci(operation, args) {
    try {
      return executor('oci', ['os', 'object', operation, ...common, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000,
        maxBuffer: 262144,
      })
    } catch {
      // No raw CLI output, credentials or upstream error bodies in logs.
      throw new Error(
        `OCI ${operation} failed. Check permissions, initialized index and ETag conflicts; retry without deleting the index.`,
      )
    }
  }
  const directory = await mkdtemp(join(tmpdir(), 'gpath-archive-'))
  try {
    const indexName = 'gpath/releases/index.json'
    // Fail closed if the index is missing/unreadable, never replace it with an
    // empty catalog on permission errors. Initialize explicitly once (see docs).
    const head = JSON.parse(oci('head', ['--name', indexName]))
    if (
      typeof head.etag !== 'string' ||
      !Number.isFinite(Number(head['content-length'])) ||
      Number(head['content-length']) > 131072
    ) {
      throw new Error('Invalid or oversized catalog headers')
    }
    const previousFile = join(directory, 'previous.json')
    oci('get', ['--name', indexName, '--if-match', head.etag, '--file', previousFile])
    const next = mergeCatalog(JSON.parse(await readFile(previousFile, 'utf8')), release)
    const record = `${JSON.stringify(release, null, 2)}\n`
    const digest = createHash('sha256').update(record).digest('hex')
    const recordFile = join(directory, 'release.json')
    const nextFile = join(directory, 'index.json')
    await writeFile(recordFile, record)
    await writeFile(nextFile, `${JSON.stringify(next, null, 2)}\n`)
    const name = `gpath/releases/${release.revision}-${release.runId}-${digest}.json`
    oci('put', [
      '--name',
      name,
      '--file',
      recordFile,
      '--no-overwrite',
      '--no-multipart',
      '--content-type',
      'application/json',
    ])
    // Compare-and-swap protects the catalog from lost concurrent updates.
    oci('put', [
      '--name',
      indexName,
      '--file',
      nextFile,
      '--if-match',
      head.etag,
      '--force',
      '--no-multipart',
      '--content-type',
      'application/json',
    ])
    return `Archived ${release.revision.slice(0, 7)}; catalog contains ${next.releases.length} builds.`
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(
    await publishArchive({
      metadata: JSON.parse(await readFile(process.argv[2] || 'public/release.json', 'utf8')),
      bucket: process.env.OCI_RELEASE_BUCKET,
      namespace: process.env.OCI_RELEASE_NAMESPACE,
    }),
  )
}
