import { analyzeJobs, matchesRole, roles } from './jobs.mjs'

const apiBase = 'https://boards-api.greenhouse.io/v1/boards'
const defaultSources = [
  { token: 'stripe', name: 'Stripe' },
  { token: 'vercel', name: 'Vercel' },
  { token: 'cloudflare', name: 'Cloudflare' },
  { token: 'datadog', name: 'Datadog' },
]
const defaultTtlMs = 15 * 60 * 1000

export const GREENHOUSE_SOURCES = defaultSources

export function parseGreenhouseSources(value) {
  if (!value) return defaultSources
  const sources = value.split(',').map((entry) => {
    const [token, ...nameParts] = entry.trim().split(':')
    const name = nameParts.join(':').trim() || token
    if (!/^[a-z0-9-]+$/.test(token) || !name || name.length > 80)
      throw new Error('Invalid GREENHOUSE_BOARDS')
    return { token, name }
  })
  if (!sources.length || sources.length > 12) throw new Error('Invalid GREENHOUSE_BOARDS')
  return sources
}

function decodeHtml(value) {
  let text = String(value || '')
  for (let pass = 0; pass < 2; pass++) {
    const decoded = text.replace(
      /&(?:amp|lt|gt|quot|apos|nbsp|#39|#x27|#(\d+)|#x([\da-f]+));/gi,
      (entity, decimal, hexadecimal) => {
        if (decimal) return String.fromCodePoint(Number(decimal))
        if (hexadecimal) return String.fromCodePoint(parseInt(hexadecimal, 16))
        return (
          {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&apos;': "'",
            '&nbsp;': ' ',
            '&#39;': "'",
            '&#x27;': "'",
          }[entity.toLowerCase()] || entity
        )
      },
    )
    if (decoded === text) break
    text = decoded
  }
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim()
}

async function readJson(response, maxBytes) {
  if (!response.ok) throw new Error('Greenhouse request failed')
  const reader = response.body?.getReader()
  if (!reader) return response.json()
  let size = 0
  const chunks = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new Error('Greenhouse response too large')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function fetchJson(fetcher, url, timeoutMs, maxBytes) {
  const response = await fetcher(url, {
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  return readJson(response, maxBytes)
}

function locationOf(job) {
  if (job.location?.name) return job.location.name
  const offices = Array.isArray(job.offices) ? job.offices.map((office) => office.name) : []
  return offices.filter(Boolean).join(' · ') || 'Ubicación no indicada'
}

function normalizeJob(source, role, summary, detail) {
  const description = decodeHtml(detail.content || summary.content || '')
  const title = String(detail.title || summary.title || '').trim()
  if (!title || !description) return null
  const url = detail.absolute_url || summary.absolute_url
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return null
  return {
    id: `${source.token}:${detail.id || summary.id}`,
    role,
    company: detail.company_name || summary.company_name || source.name,
    title,
    location: locationOf(detail.location ? detail : summary),
    description: description.slice(0, 560),
    searchText: description,
    skills: [],
    url,
    source: source.name,
    updatedAt: detail.updated_at || summary.updated_at || null,
  }
}

export function createGreenhouseJobs({
  sources = defaultSources,
  fetcher = fetch,
  clock = Date.now,
  ttl = defaultTtlMs,
  timeoutMs = 7000,
  maxJobsPerSource = 6,
} = {}) {
  if (!Array.isArray(sources) || !sources.length)
    throw new Error('At least one job source is required')
  let boardCache
  let boardCheckedAt = 0
  let boardInflight
  const resultCache = new Map()
  const resultInflight = new Map()

  async function readBoards() {
    if (boardCache && clock() - boardCheckedAt < ttl) return boardCache
    if (!boardInflight) {
      boardInflight = Promise.all(
        sources.map(async (source) => {
          try {
            const payload = await fetchJson(
              fetcher,
              `${apiBase}/${source.token}/jobs`,
              timeoutMs,
              750_000,
            )
            if (!Array.isArray(payload.jobs)) throw new Error('Invalid Greenhouse jobs payload')
            return { source, jobs: payload.jobs, ok: true }
          } catch {
            return { source, jobs: [], ok: false }
          }
        }),
      )
        .then((value) => {
          if (!value.some((board) => board.ok)) throw new Error('All Greenhouse sources failed')
          boardCache = value
          boardCheckedAt = clock()
          return value
        })
        .finally(() => {
          boardInflight = null
        })
    }
    return boardInflight
  }

  async function refresh(role) {
    const boards = await readBoards()
    const candidates = boards.flatMap(({ source, jobs }) =>
      jobs
        .filter((job) => matchesRole(role, String(job.title || '')))
        .sort((a, b) => Date.parse(b.updated_at || '') - Date.parse(a.updated_at || ''))
        .slice(0, maxJobsPerSource)
        .map((summary) => ({ source, summary })),
    )
    const detailed = await Promise.all(
      candidates.map(async ({ source, summary }) => {
        try {
          const detail = await fetchJson(
            fetcher,
            `${apiBase}/${source.token}/jobs/${encodeURIComponent(summary.id)}`,
            timeoutMs,
            512_000,
          )
          return normalizeJob(source, role, summary, detail)
        } catch {
          return null
        }
      }),
    )
    const jobs = detailed.filter(Boolean)
    const sourceNames = [...new Set(jobs.map((job) => job.source))]
    return {
      ...analyzeJobs(role, jobs),
      mode: 'live',
      collectedAt: new Date(clock()).toISOString(),
      source: 'Greenhouse Job Board API',
      sourceCount: sourceNames.length,
      sourceNames,
      sampleLimit: maxJobsPerSource,
      partial: boards.some((board) => !board.ok),
    }
  }

  return {
    async read(role) {
      if (!Object.hasOwn(roles, role)) throw new RangeError('Invalid role')
      const cached = resultCache.get(role)
      if (cached && clock() - cached.checkedAt < ttl) return cached.value
      if (!resultInflight.has(role)) {
        const request = refresh(role)
          .then((value) => {
            resultCache.set(role, { checkedAt: clock(), value })
            return value
          })
          .finally(() => resultInflight.delete(role))
        resultInflight.set(role, request)
      }
      return resultInflight.get(role)
    },
  }
}
