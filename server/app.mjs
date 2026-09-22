import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { parseRelease } from '../shared/release.mjs'
import { AnalysisInputError, createOfferAnalyzer, parseAnalysisRequest } from './analyzer.mjs'

const maxAnalysisRequestBytes = 48_000

function readAnalysisBody(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || ''
    if (!/^application\/json(?:;|$)/i.test(contentType)) {
      req.resume()
      return reject(
        new AnalysisInputError('El análisis debe enviarse como JSON.', {
          status: 415,
          code: 'unsupported_content_type',
        }),
      )
    }
    const declaredLength = Number(req.headers['content-length'])
    if (Number.isFinite(declaredLength) && declaredLength > maxAnalysisRequestBytes) {
      req.resume()
      return reject(
        new AnalysisInputError('La información enviada es demasiado extensa.', {
          status: 413,
          code: 'request_too_large',
        }),
      )
    }
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      if (tooLarge) return
      size += chunk.length
      if (size > maxAnalysisRequestBytes) {
        tooLarge = true
        return reject(
          new AnalysisInputError('La información enviada es demasiado extensa.', {
            status: 413,
            code: 'request_too_large',
          }),
        )
      }
      chunks.push(chunk)
    })
    req.on('error', () =>
      reject(new AnalysisInputError('No pudimos leer los datos del análisis.', { code: 'request_read_failed' })),
    )
    req.on('end', () => {
      if (tooLarge) return
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new AnalysisInputError('El análisis debe enviarse como JSON válido.', { code: 'invalid_json' }))
      }
    })
  })
}

export function createApi({
  release: metadata,
  environment = 'local',
  analyzer = createOfferAnalyzer(),
  log = () => {},
}) {
  const release = parseRelease(metadata)
  if (!['local', 'container', 'k3s'].includes(environment))
    throw new Error('Invalid runtime environment')
  const startedAt = Date.now()
  return createServer(
    { requestTimeout: 60_000, headersTimeout: 10_000, maxHeaderSize: 8192 },
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
      let path
      try {
        path = new URL(req.url, 'http://localhost').pathname
      } catch {
        return send(400, { error: 'Invalid path' })
      }
      if (req.method === 'POST' && path === '/api/analyze') {
        try {
          const request = parseAnalysisRequest(await readAnalysisBody(req))
          return send(200, await analyzer.analyze(request))
        } catch (error) {
          if (error instanceof AnalysisInputError)
            return send(error.status, { error: error.message })
          if (error?.name === 'OfferReadError')
            return send(error.status || 422, { error: error.message })
          return send(503, {
            error: 'No se pudo completar el análisis. Prueba con el texto de la oferta.',
          })
        }
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD, POST')
        return send(405, { error: 'Method not allowed' })
      }
      try {
        switch (path) {
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
          default:
            return send(404, { error: 'Route not found' })
        }
      } catch {
        return send(500, { error: 'Request failed', requestId })
      }
    },
  )
}
