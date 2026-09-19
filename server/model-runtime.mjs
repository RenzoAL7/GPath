const timeoutMs = 25_000

function endpoint(value) {
  if (!value) return null
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('Invalid MODEL_RUNTIME_URL')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid MODEL_RUNTIME_URL')
  return url.toString().replace(/\/$/, '')
}

async function callRuntime(fetcher, baseUrl, path, body) {
  const response = await fetcher(baseUrl + path, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error('Model runtime request failed')
  return response.json()
}

/**
 * Adapts a deployment-local model service. The GPath API never exposes this
 * endpoint to browsers and never downloads model objects itself. The service
 * must own the compatible JobBERT and Qwen runtimes mounted under /models.
 */
export function createModelRuntime({ assets, url = process.env.MODEL_RUNTIME_URL, fetcher = fetch } = {}) {
  if (!assets || !['local', 'oci'].includes(assets.source)) throw new Error('Invalid model assets')
  const baseUrl = endpoint(url)
  if (!baseUrl) return Object.freeze({ available: false })
  const modelPaths = Object.freeze({
    jobBertModelDir: assets.jobBertModelDir,
    qwenModelPath: assets.qwenModelPath,
  })
  return Object.freeze({
    available: true,
    async extractRequirements({ text, targetRole }) {
      return callRuntime(fetcher, baseUrl, '/extract', {
        text,
        targetRole,
        model: { qwenModelPath: modelPaths.qwenModelPath },
      })
    },
    async semanticSimilarity({ text, targetRole, requirements, profile }) {
      return callRuntime(fetcher, baseUrl, '/similarity', {
        text,
        targetRole,
        requirements,
        profile,
        model: { jobBertModelDir: modelPaths.jobBertModelDir },
      })
    },
    async explain({ targetRole, requirements, profile, compatibility, factors }) {
      return callRuntime(fetcher, baseUrl, '/explain', {
        targetRole,
        requirements,
        profile,
        compatibility,
        factors,
        model: { qwenModelPath: modelPaths.qwenModelPath },
      })
    },
  })
}
