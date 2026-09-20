import { lookup as dnsLookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'

const maxRedirects = 3
const maxBytes = 1_000_000
const requestTimeout = 12_000

export class OfferReadError extends Error {
  constructor(message, { status = 422, code = 'offer_unavailable' } = {}) {
    super(message)
    this.name = 'OfferReadError'
    this.status = status
    this.code = code
  }
}

function normalizedHostname(value) {
  return value.toLowerCase().replace(/\.$/, '')
}

function isLinkedInHost(hostname) {
  return /(^|\.)linkedin\.com$/i.test(normalizedHostname(hostname))
}

function isLinkedInLoginUrl(url) {
  return isLinkedInHost(url.hostname) && /^\/(?:uas\/login|login)(?:\/|$)/i.test(url.pathname)
}

function normalizeLinkedInSearchUrl(url) {
  if (!isLinkedInHost(url.hostname) || !/\/jobs\/search-results(?:\/|$)/i.test(url.pathname))
    return url
  const currentJobId = url.searchParams.get('currentJobId')?.trim() || ''
  if (/^\d+$/.test(currentJobId)) return new URL(`/jobs/view/${currentJobId}`, url.origin)
  throw new OfferReadError(
    'Ese enlace es una búsqueda de LinkedIn. Abre una oferta individual o pega su descripción.',
    { code: 'linkedin_search' },
  )
}

function ipv4IsPublic(address) {
  const octets = address.split('.').map(Number)
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  )
    return false
  const [first, second] = octets
  if (first === 0 || first === 10 || first === 127 || first >= 224) return false
  if (first === 100 && second >= 64 && second <= 127) return false
  if (first === 169 && second === 254) return false
  if (first === 172 && second >= 16 && second <= 31) return false
  if (first === 192 && second === 168) return false
  if (first === 192 && second === 0) return false
  if (first === 198 && (second === 18 || second === 19 || second === 51)) return false
  if (first === 203 && second === 0 && octets[2] === 113) return false
  return true
}

function ipv6IsPublic(address) {
  const normalized = address.toLowerCase().split('%')[0]
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8')
  )
    return false
  // IPv4-mapped IPv6 must follow the IPv4 policy too.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return mapped ? ipv4IsPublic(mapped[1]) : true
}

export function isPublicAddress(address) {
  if (typeof address !== 'string' || !address) return false
  return address.includes(':') ? ipv6IsPublic(address) : ipv4IsPublic(address)
}

export function validatePublicOfferUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new OfferReadError('El enlace no tiene un formato válido.', { code: 'invalid_url' })
  }
  const hostname = normalizedHostname(url.hostname)
  if (
    url.protocol !== 'https:' ||
    !hostname ||
    url.username ||
    url.password ||
    url.port ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    /^[\d.]+$/.test(hostname) ||
    hostname.includes(':')
  ) {
    throw new OfferReadError('Usa un enlace HTTPS público de la oferta.', { code: 'unsafe_url' })
  }
  return normalizeLinkedInSearchUrl(url)
}

async function resolvePublicAddress(url, lookup = dnsLookup) {
  let records
  try {
    records = await lookup(url.hostname, { all: true, verbatim: true })
  } catch {
    throw new OfferReadError('No se pudo acceder al enlace de la oferta.', { code: 'dns_failed' })
  }
  if (
    !Array.isArray(records) ||
    !records.length ||
    records.some((record) => !isPublicAddress(record.address))
  ) {
    throw new OfferReadError('El enlace debe apuntar a una oferta pública accesible.', {
      code: 'private_address',
    })
  }
  return records[0]
}

function requestOnce(url, address, { timeout = requestTimeout, maxSize = maxBytes } = {}) {
  const transport = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const request = transport.request(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'text/html, text/plain;q=0.9',
          'Accept-Encoding': 'identity',
          'User-Agent': 'GPath offer analyzer/1.0',
        },
        lookup: (_hostname, lookupOptions, callback) => {
          if (lookupOptions?.all)
            return callback(null, [{ address: address.address, family: address.family }])
          return callback(null, address.address, address.family)
        },
        servername: url.hostname,
      },
      (response) => {
        const declaredLength = Number(response.headers['content-length'])
        if (Number.isFinite(declaredLength) && declaredLength > maxSize) {
          response.resume()
          return fail(
            new OfferReadError('La oferta es demasiado extensa para analizarla.', {
              status: 413,
              code: 'content_too_large',
            }),
          )
        }
        const chunks = []
        let size = 0
        response.on('data', (chunk) => {
          size += chunk.length
          if (size > maxSize) {
            response.destroy()
            return fail(
              new OfferReadError('La oferta es demasiado extensa para analizarla.', {
                status: 413,
                code: 'content_too_large',
              }),
            )
          }
          chunks.push(chunk)
        })
        response.on('error', () =>
          fail(
            new OfferReadError('No se pudo leer el contenido de la oferta.', {
              code: 'read_failed',
            }),
          ),
        )
        response.on('end', () => {
          if (settled) return
          settled = true
          resolve({
            status: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )
    request.setTimeout(timeout, () =>
      request.destroy(
        new OfferReadError('La oferta tardó demasiado en responder. Prueba pegando el texto.', {
          status: 504,
          code: 'timeout',
        }),
      ),
    )
    request.on('error', (error) => {
      if (error instanceof OfferReadError) return fail(error)
      return fail(
        new OfferReadError('No se pudo acceder al enlace de la oferta.', {
          code: 'request_failed',
        }),
      )
    })
    request.end()
  })
}

function supportedContentType(headers) {
  const value = headers['content-type'] || ''
  return /^text\/(?:html|plain)(?:;|$)/i.test(value)
}

/**
 * Reads a public offer while pinning the connection to an address checked for
 * private-network ranges. It intentionally does not execute page scripts,
 * send cookies, or follow more than a small number of redirects.
 */
export async function readPublicOffer(value, options = {}) {
  let current = validatePublicOfferUrl(value)
  const lookup = options.lookup || dnsLookup
  const request = options.request || requestOnce
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const address = await resolvePublicAddress(current, lookup)
    const response = await request(current, address, options)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === maxRedirects)
        throw new OfferReadError('El enlace redirige demasiadas veces.', {
          code: 'too_many_redirects',
        })
      const location = response.headers.location
      if (!location)
        throw new OfferReadError('El enlace de la oferta no se pudo seguir.', {
          code: 'invalid_redirect',
        })
      const next = validatePublicOfferUrl(new URL(location, current).toString())
      if (isLinkedInLoginUrl(next)) {
        throw new OfferReadError(
          'LinkedIn pide iniciar sesión para mostrar esta oferta. Abre el puesto individual o pega la descripción.',
          { code: 'linkedin_login' },
        )
      }
      current = next
      continue
    }
    if (response.status < 200 || response.status >= 300)
      throw new OfferReadError('La oferta no está disponible públicamente.', {
        code: 'upstream_status',
      })
    if (!supportedContentType(response.headers))
      throw new OfferReadError('El enlace no contiene una oferta que podamos leer.', {
        status: 415,
        code: 'unsupported_content',
      })
    return { text: response.body, originalUrl: current.toString() }
  }
  throw new OfferReadError('No se pudo leer el enlace de la oferta.', { code: 'read_failed' })
}
