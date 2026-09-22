import { readFile } from 'node:fs/promises'
import { createApi } from './app.mjs'
import { createOfferAnalyzer } from './analyzer.mjs'
import { modelAssetsStatus, parseModelAssets } from './model-assets.mjs'
import { createModelRuntime } from './model-runtime.mjs'

const port = Number(process.env.PORT || 8081)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
const release = JSON.parse(
  await readFile(new URL('../public/release.json', import.meta.url), 'utf8'),
)
const modelAssets = parseModelAssets()
const modelRuntime = createModelRuntime({ assets: modelAssets })
const analyzer = createOfferAnalyzer({
  extractRequirements: modelRuntime.extractRequirements,
  semanticSimilarity: modelRuntime.semanticSimilarity,
  explain: modelRuntime.explain,
})
const server = createApi({
  release,
  environment: process.env.RUNTIME_ENV || 'local',
  analyzer,
  log: (entry) => console.log(JSON.stringify(entry)),
})
server.listen(port, process.env.HOST || '0.0.0.0', () =>
  console.log(
    JSON.stringify({
      event: 'api_started',
      port,
      modelRuntime: modelRuntime.available ? 'configured' : 'not-configured',
      modelAssets: modelAssetsStatus(modelAssets),
    }),
  ),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 8000).unref()
  })
