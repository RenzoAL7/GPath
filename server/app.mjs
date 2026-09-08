import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { parseRelease } from '../shared/release.mjs'
import { createArchive } from './archive.mjs'
import { demoAnalysis, parseJobFilters, roles } from './jobs.mjs'

export function createApi({
  release: metadata,
  environment = 'local',
  archive = createArchive(),
  jobs = { read: async (role, filters) => demoAnalysis(role, filters) },
  log = () => {},
}) {
  const release = parseRelease(metadata)
  if (!['local', 'container', 'k3s'].includes(environment))
    throw new Error('Invalid runtime environment')
  const startedAt = Date.now()
  return createServer(
    { requestTimeout: 10_000, headersTimeout: 10_000, maxHeaderSize: 8192 },
    async (req, res) => {
      const requestId = randomUUID()
      const start = performance.now()
      const send = (status, payload) => {
        res.writeHead(status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Request-Id': requestId,
          'X-GPath-Revision': release.revision,
        })
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify(payload))
        log({ requestId, status, durationMs: Math.round(performance.now() - start) })
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD')
        return send(405, { error: 'Method not allowed' })
      }
      let path
      try {
        path = new URL(req.url, 'http://localhost').pathname
      } catch {
        return send(400, { error: 'Invalid path' })
      }
      try {
        switch (path) {
          case '/api/jobs': {
            const requestUrl = new URL(req.url, 'http://localhost')
            const role = requestUrl.searchParams.get('role') || 'data-intern'
            if (!Object.hasOwn(roles, role))
              return send(400, { error: 'Selecciona uno de los puestos disponibles.' })
            let filters
            try {
              filters = parseJobFilters(requestUrl.searchParams)
            } catch (error) {
              if (error instanceof RangeError) return send(400, { error: error.message })
              throw error
            }
            try {
              return send(200, await jobs.read(role, filters))
            } catch {
              return send(502, {
                error: 'No se pudieron consultar las ofertas públicas. Inténtalo de nuevo.',
              })
            }
          }
          case '/healthz':
          case '/readyz':
            return send(200, { status: 'ok' })
          case '/api/release':
            return send(200, { release, environment })
          case '/api/probe':
            return send(200, {
              requestId,
              receivedAt: new Date().toISOString(),
              service: 'gpath-api',
              environment,
              revision: release.revision,
              uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
            })
          case '/api/releases':
            return send(200, await archive.read())
          default:
            return send(404, { error: 'Route not found' })
        }
      } catch {
        return send(500, { error: 'Request failed', requestId })
      }
    },
  )
}
