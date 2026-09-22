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

function beforeApplying(result: AnalysisResult) {
  const questions: string[] = []
  if (/h[ií]brid/i.test(result.requirements.workMode || ''))
    questions.push('cuántos días son presenciales')
  if (!result.requirements.workMode) questions.push('cuál es la modalidad')
  if (!result.requirements.location) questions.push('dónde se realiza el trabajo')
  if (!result.requirements.salary) questions.push('cuál es el rango salarial')
  return questions.length ? `Confirma ${formatList(questions)} antes de decidir si postulas.` : null
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
    if (hasSavedOffer() && index === activeStepIndex + 1) return 'next'
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

        <section
          className={`workflow-card ${phase === 'result' ? 'analysis-card' : ''}`}
          id="analizador"
          aria-busy={loading}
        >
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
              <header className="analysis-heading">
                <p className="section-label">Paso 3 · Análisis de una oferta</p>
                <h2 id="analysis-result-title">{offerTitle(result)}</h2>
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

              {beforeApplying(result) && (
                <aside className="analysis-confirm" aria-label="Antes de postular">
                  <strong>Antes de postular</strong>
                  <span>{beforeApplying(result)}</span>
                </aside>
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

      <footer>
        <p>
          GrowPath <span>Analizador de ofertas</span>
        </p>
      </footer>
    </div>
  )
}
