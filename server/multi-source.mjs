import { analyzeJobs, normalizeJobFilters, roles } from './jobs.mjs'

const defaultTtlMs = 15 * 60 * 1000

export function createMultiSourceJobs({
  providers,
  clock = Date.now,
  ttl = defaultTtlMs,
  sampleLimit = 6,
} = {}) {
  if (!Array.isArray(providers) || !providers.length)
    throw new Error('At least one job provider is required')
  const resultCache = new Map()
  const resultInflight = new Map()

  async function refresh(role, filters) {
    const selectedFilters = normalizeJobFilters(filters)
    const outcomes = await Promise.all(
      providers.map(async (provider) => {
        try {
          return { value: await provider.read(role, selectedFilters), ok: true }
        } catch {
          return { value: null, ok: false }
        }
      }),
    )
    const values = outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.value)
    if (!values.length) throw new Error('All job providers failed')
    const sourceNames = [...new Set(values.flatMap((value) => value.sourceNames || []))]
    return {
      ...analyzeJobs(
        role,
        values.flatMap((value) => value.jobs || []),
        selectedFilters,
      ),
      mode: 'live',
      collectedAt: new Date(clock()).toISOString(),
      source: 'APIs públicas de Greenhouse, Lever y Ashby',
      sourceCount: sourceNames.length,
      sourceNames,
      sampleLimit,
      partial: outcomes.some((outcome) => !outcome.ok) || values.some((value) => value.partial),
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
