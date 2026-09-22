// One public contract for build metadata and the runtime API.
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
