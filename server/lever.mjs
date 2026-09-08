import { analyzeJobs, matchesRole, normalizeJobFilters, roles } from './jobs.mjs'
import { decodeHtml, fetchJson, normalizeLocation } from './greenhouse.mjs'

const apiBase = 'https://api.lever.co/v0/postings'
const defaultSources = [
  { site: 'deuna', name: 'DEUNA' },
  { site: 'xepelin', name: 'Xepelin' },
  { site: 'solopulseco', name: 'SoloPulse' },
  { site: 'shopback-2', name: 'ShopBack' },
]
const defaultTtlMs = 15 * 60 * 1000

export const LEVER_SOURCES = defaultSources

export function parseLeverSources(value) {
  if (!value) return defaultSources
  const sources = value.split(',').map((entry) => {
    const [site, ...nameParts] = entry.trim().split(':')
    const name = nameParts.join(':').trim() || site
    if (!/^[A-Za-z0-9_-]+$/.test(site) || !name || name.length > 80)
      throw new Error('Invalid LEVER_SITES')
    return { site, name }
  })
  if (!sources.length || sources.length > 12) throw new Error('Invalid LEVER_SITES')
  return sources
}

function locationOf(job) {
  const allLocations = Array.isArray(job.categories?.allLocations)
    ? job.categories.allLocations
    : []
  return [...new Set([job.categories?.location, ...allLocations].filter(Boolean))].join(' · ')
}

function dateOf(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString()
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value
  return null
}

function normalizeJob(source, role, job) {
  const description = String(
    job.descriptionPlain || decodeHtml(job.description || job.openingPlain || ''),
  ).trim()
  const title = String(job.text || '').trim()
  const url = job.hostedUrl
  if (!title || !description || typeof url !== 'string' || !/^https:\/\//i.test(url)) return null
  const location = locationOf(job) || 'Ubicación no indicada'
  return {
    id: `lever:${source.site}:${job.id}`,
    role,
    company: source.name,
    title,
    ...normalizeLocation(location, job.workplaceType),
    description: description.slice(0, 560),
    searchText: [job.descriptionPlain, job.openingPlain, job.additionalPlain]
      .filter(Boolean)
      .join(' '),
    skills: [],
    url,
    source: source.name,
    updatedAt: dateOf(job.updatedAt || job.createdAt),
  }
}

export function createLeverJobs({
  sources = defaultSources,
  fetcher = fetch,
  clock = Date.now,
  ttl = defaultTtlMs,
  timeoutMs = 5000,
  maxJobsPerSource = 6,
} = {}) {
  if (!Array.isArray(sources) || !sources.length)
    throw new Error('At least one Lever source is required')
  let boardCache
  let boardCheckedAt = 0
  let boardInflight
  const resultCache = new Map()
  const resultInflight = new Map()

  async function readBoards() {
    if (boardCache && clock() - boardCheckedAt < ttl && boardCache.every((board) => board.ok))
      return boardCache
    if (!boardInflight) {
      boardInflight = Promise.all(
        sources.map(async (source) => {
          try {
            const payload = await fetchJson(
              fetcher,
              `${apiBase}/${source.site}?mode=json`,
              timeoutMs,
              2_500_000,
            )
            if (!Array.isArray(payload)) throw new Error('Invalid Lever postings payload')
            return { source, jobs: payload, ok: true }
          } catch {
            return { source, jobs: [], ok: false }
          }
        }),
      )
        .then((value) => {
          if (!value.some((board) => board.ok)) throw new Error('All Lever sources failed')
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

  async function refresh(role, filters) {
    const selectedFilters = normalizeJobFilters(filters)
    const boards = await readBoards()
    const candidates = boards.flatMap(({ source, jobs }) =>
      jobs
        .filter((job) => matchesRole(role, String(job.text || '')))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, maxJobsPerSource)
        .map((job) => normalizeJob(source, role, job)),
    )
    const jobs = candidates.filter(Boolean)
    const sourceNames = boards.filter((board) => board.ok).map(({ source }) => source.name)
    return {
      ...analyzeJobs(role, jobs, selectedFilters),
      mode: 'live',
      collectedAt: new Date(clock()).toISOString(),
      source: 'Lever Postings API',
      sourceCount: sourceNames.length,
      sourceNames,
      sampleLimit: maxJobsPerSource,
      partial: boards.some((board) => !board.ok),
    }
  }

  return {
    async read(role, filters = {}) {
      if (!Object.hasOwn(roles, role)) throw new RangeError('Invalid role')
      const selectedFilters = normalizeJobFilters(filters)
      const key = `${role}:${selectedFilters.region}:${selectedFilters.country}:${selectedFilters.workMode}`
      const cached = resultCache.get(key)
      if (cached && clock() - cached.checkedAt < ttl) return cached.value
      if (!resultInflight.has(key)) {
        const request = refresh(role, selectedFilters)
          .then((value) => {
            if (!value.partial) resultCache.set(key, { checkedAt: clock(), value })
            return value
          })
          .finally(() => resultInflight.delete(key))
        resultInflight.set(key, request)
      }
      return resultInflight.get(key)
    },
  }
}
