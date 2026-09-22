export interface Release {
  schemaVersion: 1
  version: string
  revision: string
  builtAt: string
  dirty: boolean
  runId: string | null
  sourceUrl: string | null
  runUrl: string | null
}
export const repository: string
export const sourceBase: string
export function parseRelease(value: unknown): Release
