import { readFile } from 'node:fs/promises'
import { createApi } from './app.mjs'
import { createArchive } from './archive.mjs'
import { createGreenhouseJobs, parseGreenhouseSources } from './greenhouse.mjs'
import { demoAnalysis } from './jobs.mjs'

const port = Number(process.env.PORT || 8081)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
const release = JSON.parse(
  await readFile(new URL('../public/release.json', import.meta.url), 'utf8'),
)
const mode = process.env.JOB_MODE || 'live'
if (!['live', 'demo'].includes(mode)) throw new Error('Invalid JOB_MODE')
const jobs =
  mode === 'demo'
    ? { read: async (role) => demoAnalysis(role) }
    : createGreenhouseJobs({
        sources: parseGreenhouseSources(process.env.GREENHOUSE_BOARDS),
        ttl: Number(process.env.GREENHOUSE_CACHE_SECONDS || 900) * 1000,
        maxJobsPerSource: Number(process.env.GREENHOUSE_MAX_JOBS_PER_SOURCE || 6),
      })
const server = createApi({
  release,
  environment: process.env.RUNTIME_ENV || 'local',
  archive: createArchive({ url: process.env.RELEASE_CATALOG_URL }),
  jobs,
  log: (entry) => console.log(JSON.stringify(entry)),
})
server.listen(port, process.env.HOST || '0.0.0.0', () =>
  console.log(`GPath API listening on ${port}`),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 8000).unref()
  })
