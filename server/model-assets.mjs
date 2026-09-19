import path from 'node:path'

const defaults = Object.freeze({
  MODEL_SOURCE: 'local',
  OCI_REGION: 'us-ashburn-1',
  OCI_BUCKET_NAME: 'Bucket-Rnz',
  JOBBERT_OBJECT: 'models/JobBERT-v3.tar.gz',
  QWEN_OBJECT: 'models/Qwen3-1.7B-Q4_K_M.gguf',
  JOBBERT_MODEL_DIR: '/models/jobbert-v3',
  QWEN_MODEL_PATH: '/models/qwen3/Qwen3-1.7B-Q4_K_M.gguf',
  OCI_AUTH_MODE: 'config',
})

const safeSegment = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const ociRegion = /^[a-z][a-z0-9-]{1,61}-\d+$/
const ociBucket = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/

function configurationError(name) {
  return new Error(`Invalid ${name}`)
}

function valueOf(environment, name) {
  const value = environment[name]
  if (value === undefined) return defaults[name]
  if (typeof value !== 'string' || !value || value !== value.trim()) throw configurationError(name)
  return value
}

function parseObjectName(name, extension, value) {
  if (
    !value.startsWith('models/') ||
    value.endsWith('/') ||
    value.includes('\\') ||
    value.includes('//') ||
    value.split('/').some((segment) => !safeSegment.test(segment)) ||
    !value.endsWith(extension)
  ) {
    throw configurationError(name)
  }
  return value
}

function parseModelPath(name, value, { directory = false, extension = '' } = {}) {
  if (
    !path.posix.isAbsolute(value) ||
    value !== path.posix.normalize(value) ||
    value === '/models' ||
    !value.startsWith('/models/') ||
    value.includes('\\') ||
    value.split('/').slice(1).some((segment) => !safeSegment.test(segment)) ||
    (!directory && !value.endsWith(extension))
  ) {
    throw configurationError(name)
  }
  return value
}

function parseSource(value) {
  if (!['local', 'oci'].includes(value)) throw configurationError('MODEL_SOURCE')
  return value
}

function parseAuthMode(value) {
  if (!['config', 'instance_principal'].includes(value)) throw configurationError('OCI_AUTH_MODE')
  return value
}

/**
 * Parses only server-side configuration. It never reads the filesystem, calls
 * OCI, downloads an object, or starts an inference process.
 */
export function parseModelAssets(environment = process.env) {
  if (!environment || typeof environment !== 'object') throw new Error('Invalid model environment')

  const source = parseSource(valueOf(environment, 'MODEL_SOURCE'))
  const jobBertModelDir = parseModelPath(
    'JOBBERT_MODEL_DIR',
    valueOf(environment, 'JOBBERT_MODEL_DIR'),
    { directory: true },
  )
  const qwenModelPath = parseModelPath('QWEN_MODEL_PATH', valueOf(environment, 'QWEN_MODEL_PATH'), {
    extension: '.gguf',
  })
  // These are mount targets for a runtime to check; parsing does not assert
  // that either path exists or contains a usable model.
  const readyPaths = Object.freeze([jobBertModelDir, qwenModelPath])

  if (source === 'local') {
    return Object.freeze({
      source,
      region: null,
      bucketName: null,
      jobBertObject: null,
      qwenObject: null,
      jobBertModelDir,
      qwenModelPath,
      authMode: null,
      readyPaths,
    })
  }

  const region = valueOf(environment, 'OCI_REGION')
  const bucketName = valueOf(environment, 'OCI_BUCKET_NAME')
  if (!ociRegion.test(region)) throw configurationError('OCI_REGION')
  if (!ociBucket.test(bucketName) || bucketName.includes('..'))
    throw configurationError('OCI_BUCKET_NAME')

  return Object.freeze({
    source,
    region,
    bucketName,
    jobBertObject: parseObjectName(
      'JOBBERT_OBJECT',
      '.tar.gz',
      valueOf(environment, 'JOBBERT_OBJECT'),
    ),
    qwenObject: parseObjectName('QWEN_OBJECT', '.gguf', valueOf(environment, 'QWEN_OBJECT')),
    jobBertModelDir,
    qwenModelPath,
    authMode: parseAuthMode(valueOf(environment, 'OCI_AUTH_MODE')),
    readyPaths,
  })
}

/**
 * Safe to return from a health or diagnostics endpoint: it deliberately omits
 * paths, OCI bucket/object names, credentials, and configuration file details.
 */
export function modelAssetsStatus(config) {
  if (!config || !['local', 'oci'].includes(config.source)) throw new Error('Invalid model config')
  if (config.source === 'oci' && !['config', 'instance_principal'].includes(config.authMode))
    throw new Error('Invalid model config')
  return {
    source: config.source,
    assets: config.source === 'oci' ? 'oci-objects-configured' : 'local-paths-configured',
    inferenceRuntime: 'not-configured',
    authMode: config.source === 'oci' ? config.authMode || null : null,
  }
}
