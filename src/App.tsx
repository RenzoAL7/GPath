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

function offerTitle(result: AnalysisResult) {
  return (
    result.offer?.title ||
    (result.input.type === 'url' ? 'Oferta leída desde el enlace' : 'Descripción pegada por ti')
  )
}

function careerDirection(result: AnalysisResult) {
  const context = `${offerTitle(result)} ${result.targetRole.label}`.toLocaleLowerCase('es-PE')

  if (
    /(?:datos|data)/.test(context) &&
    /(?:inteligencia artificial|machine learning|\bia\b|\bml\b)/.test(context)
  ) {
    return 'datos e IA'
  }
  if (/(?:datos|data|anal[ií]tica|analytics|business intelligence|\bbi\b)/.test(context)) {
    return 'datos y analítica'
  }
  if (/(?:backend|desarrollador|desarrollo|developer|software)/.test(context)) {
    return 'desarrollo de software'
  }
  if (/(?:cloud|devops|infraestructura)/.test(context)) return 'cloud y DevOps'
  if (/(?:inteligencia artificial|machine learning|\bia\b|\bml\b)/.test(context)) {
    return 'IA y machine learning'
  }
  return null
}

function audienceSummary(result: AnalysisResult) {
  const direction = careerDirection(result)
  const entryLevel = /practicante|internship|junior/i.test(result.requirements.level || '')
  if (direction && entryLevel)
    return `Puede interesarte si ya tienes una base en ${direction} y quieres convertir proyectos de clase o portafolio en experiencia profesional.`
  if (direction)
    return `Puede interesarte si buscas trabajar en ${direction} y puedes explicar proyectos relacionados con las tareas de la oferta.`
  return 'Puede interesarte si las tareas descritas se parecen a tus proyectos y puedes explicar cómo abordarías un problema de ese tipo.'
}

function quickRead(result: AnalysisResult) {
  const direction = careerDirection(result)
  const technical = result.requirements.technical.slice(0, 3)
  const entryLevel = /practicante|internship|junior/i.test(result.requirements.level || '')
  const opening = direction
    ? entryLevel
      ? `Una oportunidad de entrada en ${direction}`
      : `Una oferta orientada a ${direction}`
    : entryLevel
      ? 'Una oportunidad de entrada para ganar experiencia aplicada'
      : 'Una oferta para sumar experiencia práctica'
  return technical.length
    ? `${opening}, que menciona ${formatList(technical)}. Revisa las tareas para saber cómo se usan en el puesto.`
    : `${opening}. El texto disponible no detalla tecnologías suficientes para valorar el trabajo técnico.`
}

function offerValue(result: AnalysisResult) {
  const technical = result.requirements.technical.slice(0, 3)
  const preferred = result.requirements.preferred.slice(0, 2)
  const level = result.requirements.level
  const values: string[] = []

  if (technical.length > 1)
    values.push(
      `Reúne ${formatList(technical)} en un mismo puesto; podrás preguntar cómo se combinan en el trabajo diario.`,
    )
  else if (technical.length === 1)
    values.push(
      `Menciona ${technical[0]} como herramienta técnica concreta para explorar durante la entrevista.`,
    )
  if (level && /practicante|internship|junior/i.test(level))
    values.push(
      `Indica un nivel de entrada (${level}), útil para valorar si coincide con tu etapa profesional.`,
    )
  if (preferred.length) {
    values.push(
      `Separa ${formatList(preferred)} como deseable, así puedes distinguir lo esencial de lo que podrías aprender después.`,
    )
  }
  if (!values.length && result.requirements.salary)
    values.push('Publica el salario, un dato concreto para evaluar las condiciones de la oferta.')
  return values.length
    ? values.slice(0, 2)
    : [
        'El texto permite ubicar el puesto, aunque faltan detalles para valorar qué experiencia ofrece.',
      ]
}

function whatToDemonstrate(result: AnalysisResult) {
  const technical = result.requirements.technical.slice(0, 3)
  const preferred = result.requirements.preferred.slice(0, 2)
  const actions: string[] = []

  if (technical.length) {
    actions.push(
      `Elige un proyecto donde hayas usado ${formatList(technical.slice(0, 2))} y cuenta qué problema resolviste.`,
    )
    if (technical.length > 2)
      actions.push(
        `Repasa ${technical[2]} y prepara una pregunta sobre cómo se usa en este equipo.`,
      )
    else actions.push('Explica una decisión que tomaste con los datos y qué resultado obtuviste.')
  }
  if (preferred.length && actions.length < 2)
    actions.push(
      `Si conoces ${formatList(preferred)}, ten un ejemplo; si no, pregunta si se aprende en el puesto.`,
    )
  return actions.length
    ? actions.slice(0, 2)
    : ['Lleva un proyecto relacionado con el puesto y pregunta qué tareas asumirías al empezar.']
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
  const inspectionFacts = inspection
    ? [
        { label: 'Nivel', value: inspection.requirements.level },
        { label: 'Ubicación', value: inspection.requirements.location },
        { label: 'Modalidad', value: inspection.requirements.workMode },
        { label: 'Salario', value: inspection.requirements.salary },
      ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value))
    : []

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
    const loadingStartedAt = performance.now()
    const minimumLoadingMs = 900
    setLastRequest(input)
    setLastPhase(nextPhase)
    setLoading(true)
    setError('')
    const timeout = window.setTimeout(() => controller.abort(), 40_000)
    let outcome:
      | { type: 'success'; payload: ReturnType<typeof parseResult> }
      | { type: 'error'; message: string }
      | null = null
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
      outcome = { type: 'success', payload }
    } catch (reason) {
      outcome = {
        type: 'error',
        message:
          reason instanceof Error && reason.message
            ? reason.message
            : 'No pudimos analizar la oferta. Comprueba el enlace o pega la descripción y vuelve a intentarlo.',
      }
    } finally {
      window.clearTimeout(timeout)
      const remainingLoadingMs = minimumLoadingMs - (performance.now() - loadingStartedAt)
      if (request.current === controller && remainingLoadingMs > 0)
        await new Promise((resolve) => window.setTimeout(resolve, remainingLoadingMs))
      if (request.current === controller) {
        if (outcome?.type === 'success') {
          if (nextPhase === 'offer') {
            setInspection(outcome.payload)
            setResult(null)
            setPhase('offer')
          } else {
            setResult(outcome.payload)
            setPhase('result')
          }
        } else if (outcome?.type === 'error') {
          setError(outcome.message)
        }
        setLoading(false)
      }
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
    if (hasSavedOffer() && index === activeStepIndex + 1) return 'next'
    return hasSavedOffer() ? 'ready' : ''
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-block">
          <a className="brand" href="/" aria-label="Ir al inicio de GrowPath">
            <span className="brand-mark" aria-hidden="true">
              <img src="/gpath-mark.svg" alt="" />
            </span>
            <span className="brand-name">GrowPath</span>
            <span className="brand-divider" aria-hidden="true">
              |
            </span>
            <span className="brand-product">Analizador de ofertas</span>
          </a>
        </div>
      </header>

      <main className={phase === 'source' ? 'source-screen' : 'review-screen'}>
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

        <section
          className={`workflow-card ${phase === 'result' ? 'analysis-card' : ''}`}
          id="analizador"
          aria-busy={loading}
        >
          {phase === 'source' && (
            <section className="step-view" aria-labelledby="source-title">
              <div className="source-entry">
                <div className="source-intro">
                  <h1 id="source-title">Pega el enlace de una oferta.</h1>
                  <p className="source-promise" id="source-help">
                    Cada requisito aparecerá junto a la cita que lo respalda.
                  </p>
                </div>

                <form className="analyze-form" onSubmit={submitSource}>
                  <label className="field-label" htmlFor="offer-url">
                    Enlace de la oferta
                  </label>
                  <div className="source-input-row">
                    <input
                      id="offer-url"
                      type="url"
                      inputMode="url"
                      placeholder="https://empresa.com/carreras/..."
                      value={url}
                      disabled={loading || hasDescription}
                      aria-describedby={sourceWarning ? 'source-help source-warning' : 'source-help'}
                      aria-invalid={Boolean(sourceWarning)}
                      onChange={(event) => updateSource('url', event.target.value)}
                    />
                    <button className="primary-action" disabled={!canSubmitSource} type="submit">
                      {loading ? 'Leyendo…' : 'Leer oferta'}
                      <FiArrowRight aria-hidden="true" />
                    </button>
                  </div>

                  <button
                    className="manual-source-toggle"
                    type="button"
                    disabled={loading}
                    onClick={() => setShowManualDescription((visible) => !visible)}
                  >
                    {showManualDescription
                      ? 'Ocultar descripción'
                      : '¿No abre? Pega la descripción.'}
                  </button>

                  {showManualDescription && (
                    <div className="manual-source">
                      <label className="field-label" htmlFor="offer-description">
                        Descripción de la oferta
                      </label>
                      <textarea
                        id="offer-description"
                        rows={7}
                        placeholder="Pega aquí el texto de la vacante tal como lo encontraste."
                        value={description}
                        disabled={loading || hasUrl}
                        aria-describedby={sourceWarning ? 'source-help source-warning' : 'source-help'}
                        aria-invalid={Boolean(sourceWarning)}
                        onChange={(event) => updateSource('description', event.target.value)}
                      />
                    </div>
                  )}

                  {sourceWarning && (
                    <p className="source-help has-warning" id="source-warning" role="alert">
                      {sourceWarning}
                    </p>
                  )}
                </form>
              </div>
            </section>
          )}

          {phase === 'offer' && inspection && (
            <section className="step-view offer-review" aria-labelledby="offer-title">
              <header className="offer-review-heading">
                <div>
                  <h1 id="offer-title">
                    {inspection.offer?.title || 'Puesto no identificado'}
                  </h1>
                  <p className="step-intro">Revisa los datos y sus citas antes de continuar.</p>
                </div>
              </header>

              <div className="offer-evidence-layout">
                <div className="offer-facts">
                  <section className="review-group" aria-labelledby="detected-requirements-title">
                    <h2 id="detected-requirements-title">Requisitos técnicos</h2>
                    {listOrEmpty(
                      inspection.requirements.technical,
                      'No se identificaron requisitos técnicos claros.',
                    )}
                  </section>

                  {inspection.requirements.preferred.length > 0 && (
                    <section className="review-group" aria-labelledby="preferred-requirements-title">
                      <h2 id="preferred-requirements-title">Deseables</h2>
                      {listOrEmpty(inspection.requirements.preferred, '')}
                    </section>
                  )}

                  {inspectionFacts.length > 0 && (
                    <section className="review-group" aria-labelledby="detected-details-title">
                      <h2 id="detected-details-title">Condiciones</h2>
                      <dl className="offer-fact-list">
                        {inspectionFacts.map((fact) => (
                          <div key={fact.label}>
                            <dt>{fact.label}</dt>
                            <dd>{fact.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  )}
                </div>

                <aside
                  className="inspection-evidence evidence-section"
                  aria-labelledby="evidence-title"
                >
                  <h2 id="evidence-title">Citas de la oferta</h2>
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
                    <p className="empty-list">No hay citas textuales disponibles.</p>
                  )}
                </aside>
              </div>
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
              <header className="analysis-heading">
                <h1 id="analysis-result-title">{offerTitle(result)}</h1>
                <div className="analysis-meta" aria-label="Datos detectados de la oferta">
                  {result.requirements.level && <span>{result.requirements.level}</span>}
                  {result.requirements.location && <span>{result.requirements.location}</span>}
                  {result.requirements.workMode && <span>{result.requirements.workMode}</span>}
                </div>
              </header>

              <section className="analysis-takeaway" aria-labelledby="takeaway-title">
                <h3 id="takeaway-title">La lectura rápida</h3>
                <p>{quickRead(result)}</p>
              </section>

              <div className="analysis-guidance">
                <section className="guidance-panel" aria-labelledby="audience-title">
                  <h3 id="audience-title">Para quién encaja</h3>
                  <p>{audienceSummary(result)}</p>
                </section>
                <section className="guidance-panel" aria-labelledby="value-title">
                  <h3 id="value-title">Qué te aporta</h3>
                  <ul>
                    {offerValue(result).map((value) => (
                      <li key={value}>{value}</li>
                    ))}
                  </ul>
                </section>
                <section className="guidance-panel" aria-labelledby="demonstrate-title">
                  <h3 id="demonstrate-title">Qué demostrar</h3>
                  <ul>
                    {whatToDemonstrate(result).map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </section>
              </div>

              {result.evidence.length > 0 && (
                <details className="analysis-citations">
                  <summary>Ver citas de la oferta</summary>
                  <ul>
                    {result.evidence.map((evidence) => (
                      <li key={`${evidence.label}-${evidence.text}`}>
                        <strong>{evidence.label}</strong>
                        <blockquote>{evidence.text}</blockquote>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {result.limitations.length > 0 && (
                <details className="analysis-limits">
                  <summary>Alcance de esta lectura</summary>
                  <ul>
                    {result.limitations.map((limitation) => (
                      <li key={limitation}>{limitation}</li>
                    ))}
                  </ul>
                </details>
              )}

              {originalUrl && (
                <a className="original-link" href={originalUrl} target="_blank" rel="noreferrer">
                  Ver oferta original <FiExternalLink aria-hidden="true" />
                </a>
              )}
            </section>
          )}
        </section>
      </main>
    </div>
  )
}
