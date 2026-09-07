// One public contract for build metadata, the API and the optional OCI archive.
export const repository = 'RenzoAL7/Gitpath'
export const sourceBase = `https://github.com/${repository}`

export function parseRelease(value) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    typeof value.revision !== 'string' ||
    !/^(local|[a-f0-9]{40})$/.test(value.revision) ||
    typeof value.version !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(value.version) ||
    typeof value.builtAt !== 'string' ||
    !Number.isFinite(Date.parse(value.builtAt)) ||
    typeof value.dirty !== 'boolean' ||
    !(value.runId === null || (typeof value.runId === 'string' && /^\d{1,24}$/.test(value.runId)))
  ) {
    throw new Error('Invalid release metadata')
  }
  // Allowlist fields; never forward arbitrary bucket content to clients.
  return {
    schemaVersion: 1,
    version: value.version,
    revision: value.revision,
    builtAt: value.builtAt,
    dirty: value.dirty,
    runId: value.runId,
    sourceUrl: value.revision === 'local' ? null : `${sourceBase}/commit/${value.revision}`,
    runUrl: value.runId === null ? null : `${sourceBase}/actions/runs/${value.runId}`,
  }
}

export function parseCatalog(value) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.releases) ||
    value.releases.length > 50
  ) {
    throw new Error('Invalid release catalog')
  }
  return { schemaVersion: 1, releases: value.releases.map(parseRelease) }
}

export function mergeCatalog(catalog, release) {
  const current = parseRelease(release)
  const previous = parseCatalog(catalog).releases
  const releases = [
    current,
    ...previous.filter(
      (item) => !(item.revision === current.revision && item.runId === current.runId),
    ),
  ]
    .sort((a, b) => Date.parse(b.builtAt) - Date.parse(a.builtAt))
    .slice(0, 50)
  return { schemaVersion: 1, releases }
}
