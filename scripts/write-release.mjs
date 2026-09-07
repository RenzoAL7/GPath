import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseRelease } from '../shared/release.mjs'

function git(...args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const explicitRevision = process.env.RELEASE_REVISION
const release = parseRelease({
  schemaVersion: 1,
  version: pkg.version,
  revision: explicitRevision || git('rev-parse', 'HEAD') || 'local',
  builtAt: process.env.RELEASE_BUILD_TIME || new Date().toISOString(),
  dirty: explicitRevision
    ? process.env.RELEASE_DIRTY !== 'false'
    : Boolean(git('status', '--porcelain')),
  runId: process.env.RELEASE_RUN_ID || null,
})
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(
  new URL('../public/release.json', import.meta.url),
  `${JSON.stringify(release, null, 2)}\n`,
)
console.log(
  `Release ${release.version} · ${release.revision.slice(0, 7)}${release.dirty ? ' (working tree)' : ''}`,
)
