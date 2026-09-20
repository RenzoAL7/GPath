import test from 'node:test'
import assert from 'node:assert/strict'
import { modelAssetsStatus, parseModelAssets } from '../server/model-assets.mjs'

test('uses local model mount paths without reading artifacts or exposing them in status', () => {
  const config = parseModelAssets({
    MODEL_SOURCE: 'local',
    JOBBERT_MODEL_DIR: '/models/jobbert-v3',
    QWEN_MODEL_PATH: '/models/qwen3/Qwen3-1.7B-Q4_K_M.gguf',
  })
  assert.deepEqual(config.readyPaths, [
    '/models/jobbert-v3',
    '/models/qwen3/Qwen3-1.7B-Q4_K_M.gguf',
  ])
  assert.deepEqual(modelAssetsStatus(config), {
    source: 'local',
    assets: 'local-paths-configured',
    inferenceRuntime: 'not-configured',
    authMode: null,
  })
  assert.doesNotMatch(JSON.stringify(modelAssetsStatus(config)), /models|JobBERT|Qwen/i)
})

test('accepts the fixed OCI objects and rejects unsafe model configuration', () => {
  const config = parseModelAssets({
    MODEL_SOURCE: 'oci',
    OCI_REGION: 'us-ashburn-1',
    OCI_BUCKET_NAME: 'Bucket-Rnz',
    JOBBERT_OBJECT: 'models/JobBERT-v3.tar.gz',
    QWEN_OBJECT: 'models/Qwen3-1.7B-Q4_K_M.gguf',
    JOBBERT_MODEL_DIR: '/models/jobbert-v3',
    QWEN_MODEL_PATH: '/models/qwen3/Qwen3-1.7B-Q4_K_M.gguf',
    OCI_AUTH_MODE: 'instance_principal',
  })
  assert.equal(config.authMode, 'instance_principal')
  assert.equal(modelAssetsStatus(config).assets, 'oci-objects-configured')
  assert.throws(() =>
    parseModelAssets({
      ...process.env,
      MODEL_SOURCE: 'oci',
      OCI_REGION: 'us-ashburn-1',
      OCI_BUCKET_NAME: 'Bucket-Rnz',
      JOBBERT_OBJECT: '../secret.tar.gz',
      QWEN_OBJECT: 'models/Qwen3-1.7B-Q4_K_M.gguf',
      JOBBERT_MODEL_DIR: '/models/jobbert-v3',
      QWEN_MODEL_PATH: '/models/qwen3/Qwen3-1.7B-Q4_K_M.gguf',
      OCI_AUTH_MODE: 'config',
    }),
  )
})
