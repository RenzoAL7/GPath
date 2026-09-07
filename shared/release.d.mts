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
export interface Catalog {
  schemaVersion: 1
  releases: Release[]
}
export const repository: string
export const sourceBase: string
export function parseRelease(value: unknown): Release
export function parseCatalog(value: unknown): Catalog
export function mergeCatalog(catalog: unknown, release: unknown): Catalog
