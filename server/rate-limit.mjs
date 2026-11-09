import { isIP } from 'node:net'

const headerName = /^[a-z0-9-]+$/

/**
 * Fixed-window counter held in memory. The number of tracked clients is
 * bounded, so rotating identifiers cannot grow the map without limit.
 */
export function createRateLimiter({
  windowMs = 60_000,
  max = 10,
  maxKeys = 10_000,
  now = Date.now,
} = {}) {
  const buckets = new Map()

  function makeRoom(at) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= at) buckets.delete(key)
    if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value)
  }

  return {
    check(key) {
      const at = now()
      let bucket = buckets.get(key)
      if (!bucket || bucket.resetAt <= at) {
        buckets.delete(key)
        if (buckets.size >= maxKeys) makeRoom(at)
        bucket = { count: 0, resetAt: at + windowMs }
        buckets.set(key, bucket)
      }
      if (bucket.count >= max)
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - at) / 1000)),
        }
      bucket.count += 1
      return { allowed: true, remaining: max - bucket.count, retryAfterSeconds: 0 }
    },
    get size() {
      return buckets.size
    },
  }
}

export function createConcurrencyLimiter(max) {
  let active = 0
  return {
    tryAcquire() {
      if (active >= max) return null
      active += 1
      let released = false
      return () => {
        if (released) return
        released = true
        active -= 1
      }
    },
    get active() {
      return active
    },
  }
}

function ipv6Groups(address) {
  const [head, tail] = address.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const missing = address.includes('::') ? 8 - left.length - right.length : 0
  return [...left, ...Array(Math.max(0, missing)).fill('0'), ...right].map((group) =>
    group.replace(/^0+(?=.)/, '').toLowerCase(),
  )
}

/**
 * IPv4 clients are counted per address. IPv6 clients are counted per /64,
 * because one subscriber normally controls every address inside that prefix.
 */
export function clientKey(value) {
  const address = String(value || '').split('%')[0]
  const dotted = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (dotted) return dotted[1]
  if (isIP(address) !== 6) return address || 'unknown'
  const groups = ipv6Groups(address)
  if (groups.slice(0, 5).every((group) => group === '0') && groups[5] === 'ffff') {
    const high = parseInt(groups[6], 16)
    const low = parseInt(groups[7], 16)
    return [high >> 8, high & 255, low >> 8, low & 255].join('.')
  }
  return `${groups.slice(0, 4).join(':')}::/64`
}

export function clientAddress(req, header = '') {
  const forwarded = header ? req.headers[header] : undefined
  const candidate = typeof forwarded === 'string' ? forwarded.trim() : ''
  return isIP(candidate) ? candidate : req.socket.remoteAddress || 'unknown'
}

function positiveInteger(value, name, fallback) {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Invalid ${name}`)
  return parsed
}

export function parseAnalysisLimits(env = process.env) {
  const clientIpHeader = (env.CLIENT_IP_HEADER || '').trim().toLowerCase()
  if (clientIpHeader && !headerName.test(clientIpHeader))
    throw new Error('Invalid CLIENT_IP_HEADER')
  return {
    perClient: positiveInteger(env.ANALYZE_RATE_PER_MINUTE, 'ANALYZE_RATE_PER_MINUTE', 10),
    global: positiveInteger(env.ANALYZE_GLOBAL_PER_MINUTE, 'ANALYZE_GLOBAL_PER_MINUTE', 120),
    concurrent: positiveInteger(env.ANALYZE_MAX_CONCURRENT, 'ANALYZE_MAX_CONCURRENT', 8),
    clientIpHeader,
  }
}

function waitMessage(seconds) {
  return `Hiciste varios análisis seguidos. Espera ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'} y vuelve a intentarlo.`
}

/**
 * Admission order matters: a client over its own limit is rejected first, so
 * it cannot spend the global quota that other people depend on.
 */
export function createAnalysisLimits({
  perClient = 10,
  global: globalMax = 120,
  concurrent = 8,
  clientIpHeader = '',
  windowMs = 60_000,
  now = Date.now,
} = {}) {
  const clients = createRateLimiter({ windowMs, max: perClient, now })
  const everyone = createRateLimiter({ windowMs, max: globalMax, maxKeys: 1, now })
  const running = createConcurrencyLimiter(concurrent)

  return {
    admit(req) {
      const client = clients.check(clientKey(clientAddress(req, clientIpHeader)))
      if (!client.allowed)
        return {
          allowed: false,
          status: 429,
          reason: 'client',
          retryAfterSeconds: client.retryAfterSeconds,
          message: waitMessage(client.retryAfterSeconds),
        }
      const total = everyone.check('all')
      if (!total.allowed)
        return {
          allowed: false,
          status: 429,
          reason: 'global',
          retryAfterSeconds: total.retryAfterSeconds,
          message: `Hay muchas personas analizando ofertas. Espera ${total.retryAfterSeconds} segundos y vuelve a intentarlo.`,
        }
      const release = running.tryAcquire()
      if (!release)
        return {
          allowed: false,
          status: 503,
          reason: 'concurrency',
          retryAfterSeconds: 5,
          message: 'Hay muchas lecturas en curso. Espera 5 segundos y vuelve a intentarlo.',
        }
      return { allowed: true, release }
    },
  }
}
