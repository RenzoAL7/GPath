import { parseCatalog, parseRelease, type Release } from '../../shared/release.mjs'

export type { Release }
export type Environment = 'local' | 'container' | 'k3s'
export interface ApiRelease {
  release: Release
  environment: Environment
}
export interface Archive {
  releases: Release[]
  status: 'connected' | 'stale' | 'unavailable' | 'not-configured'
  fetchedAt: string | null
}
export interface Probe {
  requestId: string
  receivedAt: string
  service: string
  environment: Environment
  revision: string
  uptimeSeconds: number
}

function environment(value: unknown): Environment {
  if (value !== 'local' && value !== 'container' && value !== 'k3s')
    throw new Error('Entorno no válido')
  return value
}

export async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export function parseApiRelease(value: unknown): ApiRelease {
  const data = value as Record<string, unknown> | null
  if (!data) throw new Error('Respuesta no válida')
  return { release: parseRelease(data.release), environment: environment(data.environment) }
}

export function parseArchive(value: unknown): Archive {
  const data = value as Archive | null
  if (
    !data ||
    !['connected', 'stale', 'unavailable', 'not-configured'].includes(data.status) ||
    !(
      data.fetchedAt === null ||
      (typeof data.fetchedAt === 'string' && Number.isFinite(Date.parse(data.fetchedAt)))
    )
  ) {
    throw new Error('Archivo no válido')
  }
  return { ...parseCatalog(data), status: data.status, fetchedAt: data.fetchedAt }
}

export function parseProbe(value: unknown): Probe {
  const data = value as Probe | null
  if (
    !data ||
    typeof data.requestId !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(data.requestId) ||
    typeof data.receivedAt !== 'string' ||
    !Number.isFinite(Date.parse(data.receivedAt)) ||
    data.service !== 'gpath-api' ||
    typeof data.revision !== 'string' ||
    !/^(local|[a-f0-9]{40})$/.test(data.revision) ||
    !Number.isInteger(data.uptimeSeconds) ||
    data.uptimeSeconds < 0
  )
    throw new Error('Respuesta no válida')
  return {
    requestId: data.requestId,
    receivedAt: data.receivedAt,
    service: data.service,
    environment: environment(data.environment),
    revision: data.revision,
    uptimeSeconds: data.uptimeSeconds,
  }
}

export { parseRelease }
