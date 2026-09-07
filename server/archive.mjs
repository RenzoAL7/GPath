import { parseCatalog } from '../shared/release.mjs'

const empty = { schemaVersion: 1, releases: [] }

export function createArchive({ url, fetcher = fetch, clock = Date.now, ttl = 60_000 } = {}) {
  let cached
  let checkedAt = 0
  let inflight
  if (url) {
    const target = new URL(url)
    // A fixed, server-only URL to one OCI object, never a browser-supplied URL.
    if (
      target.protocol !== 'https:' ||
      target.username ||
      target.password ||
      target.port ||
      !/^(?:[a-z0-9-]+\.)?objectstorage\.[a-z0-9-]+\.oraclecloud\.com$/.test(target.hostname)
    ) {
      throw new Error('RELEASE_CATALOG_URL must point to an HTTPS OCI Object Storage object')
    }
  }
  async function refresh() {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(4000), redirect: 'error' })
      if (!response.ok) throw new Error('Archive unavailable')
      // Bound payload size even if the upstream omits Content-Length.
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Empty archive')
      let size = 0
      const chunks = []
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.length
          if (size > 131072) throw new Error('Archive too large')
          chunks.push(value)
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
      const parsed = parseCatalog(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      cached = { ...parsed, status: 'connected', fetchedAt: new Date(clock()).toISOString() }
    } catch {
      // Do not log upstream URLs: a PAR URL is a credential.
      cached = {
        fetchedAt: null,
        ...(cached || empty),
        status: cached?.fetchedAt ? 'stale' : 'unavailable',
      }
    } finally {
      checkedAt = clock()
    }
    return cached
  }
  return {
    async read() {
      if (!url) return { ...empty, status: 'not-configured', fetchedAt: null }
      if (cached && clock() - checkedAt < ttl) return cached
      if (!inflight)
        inflight = refresh().finally(() => {
          inflight = null
        })
      return inflight
    },
  }
}
