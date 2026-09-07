import { readFile } from 'node:fs/promises'
import { createApi } from './app.mjs'
import { createArchive } from './archive.mjs'

const port = Number(process.env.PORT || 8081)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
const release = JSON.parse(
  await readFile(new URL('../public/release.json', import.meta.url), 'utf8'),
)
const server = createApi({
  release,
  environment: process.env.RUNTIME_ENV || 'local',
  archive: createArchive({ url: process.env.RELEASE_CATALOG_URL }),
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
