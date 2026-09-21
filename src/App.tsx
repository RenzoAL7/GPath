import { useEffect, useRef, useState } from 'react'
import { FiArrowRight, FiCheck, FiExternalLink } from 'react-icons/fi'

type TargetRoleId =
  | 'data-analyst'
  | 'data-engineer'
  | 'backend-developer'
  | 'cloud-devops'
  | 'machine-learning'
  | 'other'

type Profile = {
  level: 'junior'
  skills: string[]
}

type AnalyzeRequest = {
  targetRole: TargetRoleId
  profile: Profile
  url?: string
  description?: string
}

type AnalysisResult = {
  input: { type: 'url' | 'text'; originalUrl?: string }
  offer?: { title: string | null }
  targetRole: { id: TargetRoleId; label: string }
  compatibility: {
    score: number
    label: string
    recommendation: string
    scope: 'profile' | 'target'
  }
  factors: {
    id: string
    label: string
    score: number | null
    weight: number
    contribution: number
    detail: string
  }[]
  requirements: {
    technical: string[]
    preferred: string[]
    level: string | null
    location: string | null
    workMode: string | null
    salary: string | null
  }
  profile: { provided: boolean; matched: string[]; gaps: string[] }
  evidence: { label: string; text: string }[]
  explanation: string
  limitations: string[]
}

const analysisSteps = [
  'Leyendo la oferta.',
  'Extrayendo requisitos.',
  'Organizando los hallazgos.',
  'Generando la explicación.',
]

const workflowSteps = [
  { id: 'source', label: 'Leer oferta' },
  { id: 'offer', label: 'Revisar requisitos' },
  { id: 'result', label: 'Ver análisis' },
] as const

type WorkflowPhase = (typeof workflowSteps)[number]['id']

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function parseResult(value: unknown): AnalysisResult {
  const result = value as AnalysisResult | null
  if (
    !result ||
    !['url', 'text'].includes(result.input?.type) ||
    (result.offer !== undefined &&
      (!result.offer || (result.offer.title !== null && typeof result.offer.title !== 'string'))) ||
    typeof result.targetRole?.id !== 'string' ||
    typeof result.targetRole?.label !== 'string' ||
    !Number.isFinite(result.compatibility?.score) ||
    !['profile', 'target'].includes(result.compatibility?.scope) ||
    typeof result.compatibility?.label !== 'string' ||
    typeof result.compatibility?.recommendation !== 'string' ||
    !Array.isArray(result.factors) ||
    !result.factors.every(
      (factor) =>
        typeof factor.id === 'string' &&
        typeof factor.label === 'string' &&
        (factor.score === null || Number.isFinite(factor.score)) &&
        Number.isFinite(factor.weight) &&
        Number.isFinite(factor.contribution) &&
        typeof factor.detail === 'string',
    ) ||
    !isStringArray(result.requirements?.technical) ||
    !isStringArray(result.requirements?.preferred) ||
    !isStringArray(result.profile?.matched) ||
    !isStringArray(result.profile?.gaps) ||
    typeof result.profile?.provided !== 'boolean' ||
    !Array.isArray(result.evidence) ||
    !result.evidence.every(
      (evidence) => typeof evidence.label === 'string' && typeof evidence.text === 'string',
    ) ||
    typeof result.explanation !== 'string' ||
    !isStringArray(result.limitations)
  ) {
    throw new Error('Respuesta inválida')
  }
  return result
}

function safeExternalUrl(value: string | undefined) {
  return value && isHttpUrl(value) ? value : null
}

function sourceValidation(url: string, description: string) {
  const hasUrl = Boolean(url.trim())
  const hasDescription = Boolean(description.trim())
  if (hasUrl && hasDescription) return 'Usa solo una fuente: enlace o descripción.'
  if (!hasUrl && !hasDescription)
    return 'Agrega un enlace público o pega la descripción de la oferta.'
  if (hasUrl && !isHttpUrl(url.trim())) return 'Usa un enlace HTTPS público válido.'
  if (hasUrl) {
    const parsed = new URL(url.trim())
    if (
      /(^|\.)linkedin\.com$/i.test(parsed.hostname) &&
      /\/jobs\/search-results(?:\/|$)/i.test(parsed.pathname)
    ) {
      const currentJobId = parsed.searchParams.get('currentJobId')?.trim() || ''
      if (!/^\d+$/.test(currentJobId))
        return 'Ese enlace es una búsqueda de LinkedIn. Abre una oferta individual o pega su descripción.'
    }
  }
  return ''
}

function normalizeOfferUrl(value: string) {
  const parsed = new URL(value)
  if (
    /(^|\.)linkedin\.com$/i.test(parsed.hostname) &&
    /\/jobs\/search-results(?:\/|$)/i.test(parsed.pathname)
  ) {
    const currentJobId = parsed.searchParams.get('currentJobId')?.trim() || ''
    if (/^\d+$/.test(currentJobId))
      return new URL(`/jobs/view/${currentJobId}`, parsed.origin).toString()
  }
  return value
}

function listOrEmpty(values: string[], emptyText: string) {
  if (!values.length) return <p className="empty-list">{emptyText}</p>
  return (
    <ul className="result-tags">
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  )
}

function formatList(values: string[]) {
  if (values.length < 2) return values[0] || ''
  if (values.length === 2) return `${values[0]} y ${values[1]}`
  return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`
}

function audienceSummary(result: AnalysisResult) {
  const technical = result.requirements.technical.slice(0, 3)
  const preferred = result.requirements.preferred.slice(0, 2)
  const audience = /practicante|internship/i.test(result.requirements.level || '')
    ? 'quienes están iniciando su experiencia profesional'
    : /junior/i.test(result.requirements.level || '')
      ? 'quienes ya tienen una base profesional y quieren seguir desarrollándose'
      : 'quienes quieren desarrollarse en un puesto de este tipo'
  const skills = technical.length ? ` La oferta pide experiencia con ${formatList(technical)}.` : ''
  const plus = preferred.length
    ? ` ${formatList(preferred)} aparece como un requisito deseable.`
    : ''
  return `Este puesto puede ser una buena opción para ${audience}.${skills}${plus} Revisa las condiciones y las evidencias antes de postular.`
}

export default function App() {
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [showManualDescription, setShowManualDescription] = useState(false)
  const [phase, setPhase] = useState<WorkflowPhase>('source')
  const [inspection, setInspection] = useState<AnalysisResult | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [lastRequest, setLastRequest] = useState<AnalyzeRequest | null>(null)
  const [lastPhase, setLastPhase] = useState<Exclude<WorkflowPhase, 'source'> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

  const validation = sourceValidation(url, description)
  const canSubmitSource = !loading && !validation && phase === 'source'
  const hasUrl = Boolean(url.trim())
  const hasDescription = Boolean(description.trim())
  const sourceWarning = (hasUrl || hasDescription) && validation ? validation : ''
  const originalUrl =
    result?.input.type === 'url' ? safeExternalUrl(result.input.originalUrl) : null

  useEffect(
    () => () => {
      request.current?.abort()
    },
    [],
  )

  function requestFromSource(): AnalyzeRequest | null {
    if (validation) return null
    const common = {
      // The role and profile controls are intentionally out of this general
      // analysis. The API keeps these stable fallbacks for compatibility.
      targetRole: 'other' as const,
      profile: { level: 'junior' as const, skills: [] },
    }
    return hasUrl
      ? { ...common, url: normalizeOfferUrl(url.trim()) }
      : { ...common, description: description.trim() }
  }

  async function analyze(input: AnalyzeRequest, nextPhase: Exclude<WorkflowPhase, 'source'>) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLastRequest(input)
    setLastPhase(nextPhase)
    setLoading(true)
    setError('')
    const timeout = window.setTimeout(() => controller.abort(), 40_000)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as { error?: unknown } | null
        throw new Error(
          typeof problem?.error === 'string'
            ? problem.error
            : 'No pudimos analizar la oferta. Vuelve a intentarlo.',
        )
      }
      const payload = parseResult(await response.json())
      if (request.current === controller) {
        if (nextPhase === 'offer') {
          setInspection(payload)
          setResult(null)
          setPhase('offer')
        } else {
          setResult(payload)
          setPhase('result')
        }
      }
    } catch (reason) {
      if (request.current === controller)
        setError(
          reason instanceof Error && reason.message
            ? reason.message
            : 'No pudimos analizar la oferta. Comprueba el enlace o pega la descripción y vuelve a intentarlo.',
        )
    } finally {
      window.clearTimeout(timeout)
      if (request.current === controller) setLoading(false)
    }
  }

  function submitSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = requestFromSource()
    if (!input) {
      setError(validation)
      return
    }
    void analyze(input, 'offer')
  }

  function hasSavedOffer() {
    return Boolean(inspection || result)
  }

  function goToWorkflowStep(nextPhase: WorkflowPhase) {
    if (loading) return
    if (nextPhase !== 'source' && !hasSavedOffer()) return

    setError('')
    if (nextPhase === 'offer') {
      if (!inspection && result) setInspection(result)
      setPhase('offer')
      return
    }
    if (nextPhase === 'result') {
      if (!result && inspection) setResult(inspection)
      setPhase('result')
      return
    }
    setPhase('source')
  }

  function updateSource(kind: 'url' | 'description', value: string) {
    if (kind === 'url') {
      setUrl(value)
      if (value.trim()) setDescription('')
    } else {
      setDescription(value)
      if (value.trim()) setUrl('')
    }
    setInspection(null)
    setResult(null)
    setPhase('source')
    setError('')
  }

  const activeStepIndex = workflowSteps.findIndex((step) => step.id === phase)

  function workflowStepClass(step: WorkflowPhase, index: number) {
    if (step === phase) return 'current'
    if (index < activeStepIndex) return 'done'
    return hasSavedOffer() ? 'ready' : ''
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-block">
          <a className="brand" href="/" aria-label="Ir al inicio de GrowPath">
            <span className="brand-name">GrowPath</span>
            <span className="brand-divider" aria-hidden="true">
              |
            </span>
            <span className="brand-product">Analizador de ofertas</span>
          </a>
          <p className="brand-tagline">Tu ruta rápida para entender una oferta.</p>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="analyzer-title">
          <div className="hero-copy">
            <h1 id="analyzer-title">Entiende una oferta antes de postular</h1>
            <p>
              Lee los requisitos, las condiciones y las señales importantes de una oferta en un solo
              lugar.
            </p>
          </div>
        </section>

        <nav className="workflow-nav" aria-label="Pasos del análisis">
          <ol>
            {workflowSteps.map((step, index) => (
              <li key={step.id}>
                <button
                  aria-current={step.id === phase ? 'step' : undefined}
                  aria-label={`Ir a ${step.label}`}
                  className={`workflow-step ${workflowStepClass(step.id, index)}`}
                  disabled={loading || (step.id !== 'source' && !hasSavedOffer())}
                  onClick={() => goToWorkflowStep(step.id)}
                  type="button"
                >
                  <span className="step-number" aria-hidden="true">
                    {index < activeStepIndex ? <FiCheck /> : String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{step.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section className="workflow-card" id="analizador" aria-busy={loading}>
          {phase === 'source' && (
            <section className="step-view" aria-labelledby="source-title">
              <p className="step-kicker">Paso 1 de 3</p>
              <h2 id="source-title">Pega el enlace de una oferta</h2>
              <p className="step-intro">
                Usaremos el contenido público de la página. No necesitas crear una cuenta ni subir
                tu CV.
              </p>

              <form className="analyze-form" onSubmit={submitSource}>
                <label className="field-label" htmlFor="offer-url">
                  Enlace público de la oferta
                </label>
                <input
                  id="offer-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://empresa.com/carreras/..."
                  value={url}
                  disabled={loading || hasDescription}
                  aria-describedby="source-help"
                  onChange={(event) => updateSource('url', event.target.value)}
                />

                <button
                  className="manual-source-toggle"
                  type="button"
                  disabled={loading}
                  onClick={() => setShowManualDescription((visible) => !visible)}
                >
                  {showManualDescription ? 'Ocultar alternativa' : 'No puedo abrir el enlace'}
                </button>

                {showManualDescription && (
                  <div className="manual-source">
                    <label className="field-label" htmlFor="offer-description">
                      Pega la descripción de la oferta
                    </label>
                    <textarea
                      id="offer-description"
                      rows={7}
                      placeholder="Pega aquí el texto de la vacante tal como lo encontraste."
                      value={description}
                      disabled={loading || hasUrl}
                      aria-describedby="source-help"
                      onChange={(event) => updateSource('description', event.target.value)}
                    />
                  </div>
                )}

                <p className={`source-help ${sourceWarning ? 'has-warning' : ''}`} id="source-help">
                  {sourceWarning ||
                    'También puedes usar una descripción si la página requiere iniciar sesión.'}
                </p>
                <button className="primary-action" disabled={!canSubmitSource} type="submit">
                  {loading ? 'Leyendo oferta…' : 'Leer oferta'}
                  <FiArrowRight aria-hidden="true" />
                </button>
              </form>
            </section>
          )}

          {phase === 'offer' && inspection && (
            <section className="step-view" aria-labelledby="offer-title">
              <p className="step-kicker">Paso 2 de 3 · Lectura completada</p>
              <div className="step-heading-row">
                <div>
                  <h2 id="offer-title">Esto es lo que encontramos</h2>
                  <p className="step-intro">
                    Revisa la información detectada antes de abrir el análisis general.
                  </p>
                </div>
                <span className="read-status">
                  <FiCheck aria-hidden="true" /> Oferta leída
                </span>
              </div>

              <div className="offer-identity">
                <p className="section-label">Puesto de la oferta</p>
                <strong>{inspection.offer?.title || 'Puesto no identificado'}</strong>
              </div>

              <div className="offer-summary">
                <section aria-labelledby="detected-requirements-title">
                  <h3 id="detected-requirements-title">Requisitos técnicos</h3>
                  {listOrEmpty(
                    inspection.requirements.technical,
                    'No se identificaron requisitos técnicos claros.',
                  )}
                  <h3 className="summary-subheading">Deseables</h3>
                  {listOrEmpty(
                    inspection.requirements.preferred,
                    'No se identificaron requisitos deseables claros.',
                  )}
                </section>
                <section className="detected-details" aria-labelledby="detected-details-title">
                  <h3 id="detected-details-title">Datos de la oferta</h3>
                  <dl>
                    <div>
                      <dt>Nivel</dt>
                      <dd>{inspection.requirements.level || 'No indicado'}</dd>
                    </div>
                    <div>
                      <dt>Ubicación</dt>
                      <dd>{inspection.requirements.location || 'No indicada'}</dd>
                    </div>
                    <div>
                      <dt>Modalidad</dt>
                      <dd>{inspection.requirements.workMode || 'No indicada'}</dd>
                    </div>
                    {inspection.requirements.salary && (
                      <div>
                        <dt>Salario</dt>
                        <dd>{inspection.requirements.salary}</dd>
                      </div>
                    )}
                  </dl>
                </section>
              </div>

              <section
                className="inspection-evidence evidence-section"
                aria-labelledby="evidence-title"
              >
                <h3 id="evidence-title">Evidencias de la oferta</h3>
                {inspection.evidence.length ? (
                  <ul>
                    {inspection.evidence.map((evidence) => (
                      <li key={`${evidence.label}-${evidence.text}`}>
                        <strong>{evidence.label}</strong>
                        <blockquote>{evidence.text}</blockquote>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-list">No se devolvieron evidencias textuales.</p>
                )}
              </section>
            </section>
          )}

          {loading && (
            <section className="progress-panel" aria-label="Progreso del análisis">
              <p role="status" aria-live="polite">
                Leyendo y organizando la oferta.
              </p>
              <ol>
                {analysisSteps.map((step, index) => (
                  <li className={index === 0 ? 'current' : ''} key={step}>
                    <span aria-hidden="true">{index === 0 ? '•' : '○'}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {error && (
            <div className="error-message" role="alert">
              <p>{error}</p>
              {result && <p>Se mantiene el último resultado mientras vuelves a intentarlo.</p>}
              {lastRequest && lastPhase && !loading && (
                <button
                  className="retry-button"
                  type="button"
                  onClick={() => void analyze(lastRequest, lastPhase)}
                >
                  Reintentar lectura
                </button>
              )}
            </div>
          )}

          {phase === 'result' && result && (
            <section className="analysis-result" aria-labelledby="analysis-result-title">
              <p className="result-topline">
                {result.offer?.title ||
                  (result.input.type === 'url'
                    ? 'Oferta leída desde el enlace'
                    : 'Descripción pegada por ti')}
              </p>
              <div className="analysis-heading">
                <div>
                  <p className="section-label">Paso 3 · Análisis general</p>
                  <h2 id="analysis-result-title">Análisis general de la oferta</h2>
                  <p className="analysis-lede">
                    Una interpretación de lo detectado. Los requisitos y condiciones se conservan en
                    el paso anterior.
                  </p>
                </div>
                <div className="analysis-mark" aria-hidden="true">
                  <FiCheck />
                </div>
              </div>

              <section className="explanation-section" aria-labelledby="explanation-title">
                <h3 id="explanation-title">¿Para quién puede ser este puesto?</h3>
                <p>{audienceSummary(result)}</p>
              </section>

              <section className="limitations" aria-labelledby="limitations-title">
                <h3 id="limitations-title">Limitaciones del análisis</h3>
                {result.limitations.length ? (
                  <ul>
                    {result.limitations.map((limitation) => (
                      <li key={limitation}>{limitation}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-list">No se informaron limitaciones adicionales.</p>
                )}
              </section>

              {originalUrl && (
                <a className="original-link" href={originalUrl} target="_blank" rel="noreferrer">
                  Ver oferta original <FiExternalLink aria-hidden="true" />
                </a>
              )}
            </section>
          )}
        </section>
      </main>

      <footer>
        <p>
          GrowPath <span>Analizador de ofertas</span>
        </p>
      </footer>
    </div>
  )
}
