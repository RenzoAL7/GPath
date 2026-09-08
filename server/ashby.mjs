import { analyzeJobs, matchesRole, normalizeJobFilters, roles } from './jobs.mjs'
import { decodeHtml, fetchJson, normalizeLocation } from './greenhouse.mjs'

const apiBase = 'https://api.ashbyhq.com/posting-api/job-board'
const defaultSources = [
  { board: 'notion', name: 'Notion' },
  { board: 'perplexity', name: 'Perplexity' },
  { board: 'modal', name: 'Modal' },
]
const defaultTtlMs = 15 * 60 * 1000

export const ASHBY_SOURCES = defaultSources

export function parseAshbySources(value) {
  if (!value) return defaultSources
  const sources = value.split(',').map((entry) => {
    const [board, ...nameParts] = entry.trim().split(':')
    const name = nameParts.join(':').trim() || board
    if (!/^[A-Za-z0-9_-]+$/.test(board) || !name || name.length > 80)
      throw new Error('Invalid ASHBY_BOARDS')
    return { board, name }
  })
  if (!sources.length || sources.length > 12) throw new Error('Invalid ASHBY_BOARDS')
  return sources
}

function locationOf(job) {
  const secondary = Array.isArray(job.secondaryLocations)
    ? job.secondaryLocations.map((location) => location.location)
    : []
  return [...new Set([job.location, ...secondary].filter(Boolean))].join(' · ')
}

function normalizeJob(source, role, job) {
  const description = String(job.descriptionPlain || decodeHtml(job.descriptionHtml || '')).trim()
  const title = String(job.title || '').trim()
  const url = job.jobUrl
  if (
    !title ||
    !description ||
    typeof url !== 'string' ||
    !/^https:\/\//i.test(url) ||
    job.isListed === false
  )
    return null
  const location = locationOf(job) || 'Ubicación no indicada'
  const workplaceType = job.workplaceType || (job.isRemote ? 'Remote' : '')
  return {
    id: `ashby:${source.board}:${job.id}`,
    role,
    company: source.name,
    title,
    ...normalizeLocation(location, workplaceType),
    description: description.slice(0, 560),
    searchText: description,
    skills: [],
    url,
    source: source.name,
    updatedAt: job.publishedAt || null,
  }
}

export function createAshbyJobs({
  sources = defaultSources,
  fetcher = fetch,
  clock = Date.now,
  ttl = defaultTtlMs,
  timeoutMs = 7000,
  maxJobsPerSource = 6,
} = {}) {
  if (!Array.isArray(sources) || !sources.length)
    throw new Error('At least one Ashby source is required')
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
              `${apiBase}/${source.board}`,
              timeoutMs,
              5_000_000,
            )
            if (!payload || !Array.isArray(payload.jobs))
              throw new Error('Invalid Ashby postings payload')
            return { source, jobs: payload.jobs, ok: true }
          } catch {
            return { source, jobs: [], ok: false }
          }
        }),
      )
        .then((value) => {
          if (!value.some((board) => board.ok)) throw new Error('All Ashby sources failed')
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
        .filter((job) => matchesRole(role, String(job.title || '')))
        .sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''))
        .slice(0, maxJobsPerSource)
        .map((job) => normalizeJob(source, role, job)),
    )
    const jobs = candidates.filter(Boolean)
    const sourceNames = boards.filter((board) => board.ok).map(({ source }) => source.name)
    return {
      ...analyzeJobs(role, jobs, selectedFilters),
      mode: 'live',
      collectedAt: new Date(clock()).toISOString(),
      source: 'Ashby Job Postings API',
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
