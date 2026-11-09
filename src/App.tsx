import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { FiExternalLink } from 'react-icons/fi'
import { mentionsSkill } from '../shared/skills.mjs'
import { CvReadError, profileFromSkills, readCvFile, type CvProfile } from './lib/cv'

type TargetRoleId =
  | 'data-analyst'
  | 'data-engineer'
  | 'backend-developer'
  | 'cloud-devops'
  | 'machine-learning'
  | 'other'

type AnalyzeRequest = {
  targetRole: TargetRoleId
  profile: { level: 'junior'; skills: string[] }
  url?: string
  description?: string
}

type Evidence = { label: string; text: string }

type AnalysisResult = {
  input: { type: 'url' | 'text'; originalUrl?: string }
  offer?: { title: string | null }
  targetRole: { id: TargetRoleId; label: string }
  requirements: {
    technical: string[]
    preferred: string[]
    level: string | null
    location: string | null
    workMode: string | null
    salary: string | null
  }
  alerts?: { id: string; label: string; text: string }[]
  evidence: Evidence[]
  limitations: string[]
}

function isHttpUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:'
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
    typeof result.targetRole?.label !== 'string' ||
    !isStringArray(result.requirements?.technical) ||
    !isStringArray(result.requirements?.preferred) ||
    (result.alerts !== undefined &&
      (!Array.isArray(result.alerts) ||
        !result.alerts.every(
          (alert) => typeof alert.label === 'string' && typeof alert.text === 'string',
        ))) ||
    !Array.isArray(result.evidence) ||
    !result.evidence.every(
      (evidence) => typeof evidence.label === 'string' && typeof evidence.text === 'string',
    ) ||
    !isStringArray(result.limitations)
  ) {
    throw new Error('Recibimos una respuesta inesperada. Vuelve a intentarlo.')
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
  )
    return 'datos e IA'
  if (/(?:datos|data|anal[ií]tica|analytics|business intelligence|\bbi\b)/.test(context))
    return 'datos y analítica'
  if (/(?:backend|desarrollador|desarrollo|developer|software)/.test(context))
    return 'desarrollo de software'
  if (/(?:cloud|devops|infraestructura)/.test(context)) return 'cloud y DevOps'
  if (/(?:inteligencia artificial|machine learning|\bia\b|\bml\b)/.test(context))
    return 'IA y machine learning'
  return null
}

function isEntryLevel(result: AnalysisResult) {
  return /practicante|internship|junior/i.test(result.requirements.level || '')
}

function quickRead(result: AnalysisResult) {
  const direction = careerDirection(result)
  const technical = result.requirements.technical.slice(0, 3)
  const opening = direction
    ? isEntryLevel(result)
      ? `Una oportunidad de entrada en ${direction}`
      : `Una oferta orientada a ${direction}`
    : isEntryLevel(result)
      ? 'Una oportunidad de entrada para ganar experiencia aplicada'
      : 'Una oferta para sumar experiencia práctica'
  return technical.length
    ? `${opening}, que menciona ${formatList(technical)}.`
    : `${opening}. El texto disponible no detalla tecnologías suficientes para valorar el trabajo técnico.`
}

function offerValue(result: AnalysisResult) {
  const technical = result.requirements.technical.length
  const preferred = result.requirements.preferred.length
  if (preferred)
    return `Separa ${preferred === 1 ? 'una habilidad deseable' : `${preferred} habilidades deseables`} de lo esencial, así sabes qué priorizar.`
  if (technical > 1)
    return `Combina ${technical} herramientas en un mismo puesto. Pregunta cómo se usan juntas en el trabajo diario.`
  if (technical === 1) return 'Se centra en una herramienta concreta que podrás explorar a fondo.'
  return 'El texto permite ubicar el puesto, aunque faltan detalles para valorar qué experiencia ofrece.'
}

function evidenceFor(name: string, evidence: Evidence[]) {
  return evidence.find((item) => mentionsSkill(name, item.text))?.text ?? null
}

function cvSkill(name: string, cv: CvProfile | null) {
  return cv?.skills.find((skill) => skill.name === name) ?? null
}

function genericDemonstration(result: AnalysisResult) {
  const technical = result.requirements.technical.slice(0, 2)
  return technical.length
    ? `Si ya trabajaste con ${formatList(technical)}, destácalo en tu postulación y ten en mente alguna tarea o proyecto por si te preguntan.`
    : 'Destaca la experiencia que más se relacione con el puesto y pregunta qué tareas asumirías al empezar.'
}

function personalDemonstration(result: AnalysisResult, cv: CvProfile) {
  const { technical } = result.requirements
  const owned = technical.map((name) => cvSkill(name, cv)).filter((skill) => skill !== null)
  const names = owned.slice(0, 3).map((skill) => skill.name)
  if (!owned.length)
    return 'Tu CV no menciona lo que piden. Destaca la experiencia más cercana que tengas y qué te interesa aprender.'
  if (cv.source === 'manual')
    return `Ya indicaste ${formatList(names.slice(0, 2))}. Si te preguntan, ten en mente alguna tarea o proyecto donde hayas trabajado con eso.`
  const coverage = (line: string) => technical.filter((name) => mentionsSkill(name, line))
  const best = owned
    .flatMap((skill) => (skill.example && skill.line ? [skill.line] : []))
    .sort((first, second) => coverage(second).length - coverage(first).length)[0]
  return best
    ? `Tu mejor ejemplo es «${best}». Conecta con ${formatList(coverage(best))}, así que puedes usarlo si te preguntan por tu experiencia.`
    : `Tu CV ya menciona ${formatList(names)}. Si te preguntan, ten en mente alguna tarea o proyecto donde hayas trabajado con eso.`
}

function Logo() {
  return (
    <a className="brand" href="/" aria-label="Ir al inicio de GrowPath">
      <img src="/gpath-mark.svg" alt="" width="34" height="34" />
      <span className="brand-name">GrowPath</span>
    </a>
  )
}

function CvPicker({
  id,
  cv,
  reading,
  error,
  onFile,
  onSkills,
  onRemove,
}: {
  id: string
  cv: CvProfile | null
  reading: boolean
  error: string
  onFile: (file: File) => void
  onSkills: (value: string) => void
  onRemove: () => void
}) {
  const [writing, setWriting] = useState(false)
  const [skills, setSkills] = useState('')

  if (cv)
    return (
      <div className="cv-loaded">
        <span className="cv-name">{cv.label}</span>
        <button className="ghost-action" type="button" onClick={onRemove}>
          Quitar
        </button>
      </div>
    )

  return (
    <div className="cv-picker">
      <input
        className="visually-hidden"
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        disabled={reading}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
      <label className="cv-drop" htmlFor={id}>
        {reading ? 'Leyendo tu CV…' : 'Elegir PDF'}
      </label>
      <button
        className="text-action"
        type="button"
        disabled={reading}
        onClick={() => setWriting((visible) => !visible)}
      >
        {writing ? 'Ocultar' : 'Prefiero escribir mis habilidades'}
      </button>
      {writing && (
        <div className="cv-skills">
          <label htmlFor={`${id}-skills`}>Tus habilidades, separadas por comas</label>
          <div className="input-row">
            <input
              id={`${id}-skills`}
              value={skills}
              placeholder="SQL, Excel, Python"
              onChange={(event) => setSkills(event.target.value)}
            />
            <button
              className="ghost-action"
              type="button"
              disabled={!skills.trim()}
              onClick={() => onSkills(skills)}
            >
              Usar
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="cv-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function Requirement({
  name,
  kind,
  quote,
  cv,
  open,
  onToggle,
}: {
  name: string
  kind: string
  quote: string | null
  cv: CvProfile | null
  open: boolean
  onToggle: () => void
}) {
  const owned = cvSkill(name, cv)
  return (
    <li className="requirement">
      <button aria-expanded={open} type="button" onClick={onToggle}>
        <span className="requirement-name">
          {name} <small>{kind}</small>
        </span>
        {cv ? (
          <span className={`status ${owned ? 'has' : 'missing'}`}>
            <span aria-hidden="true">{owned ? '✓ ' : '○ '}</span>
            {owned ? 'Lo tienes' : 'Te falta'}
          </span>
        ) : (
          <span className="see-quote">{open ? 'Ocultar cita' : 'Ver cita'}</span>
        )}
      </button>
      {open && (
        <div className="requirement-quotes">
          <p>
            <strong>En la oferta:</strong>{' '}
            {quote ? <mark>{quote}</mark> : 'Detectado en el texto, sin cita disponible.'}
          </p>
          {cv && (
            <p>
              <strong>{cv.source === 'pdf' ? 'En tu CV:' : 'Tus habilidades:'}</strong>{' '}
              {!owned ? 'no lo encontramos.' : (owned.line ?? 'lo indicaste tú.')}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function Stop({
  number,
  title,
  aside,
  last = false,
  children,
}: {
  number: number
  title: string
  aside?: string
  last?: boolean
  children: ReactNode
}) {
  return (
    <li className={`stop ${last ? 'last' : ''}`}>
      <div className="stop-rail" aria-hidden="true">
        <span>{number}</span>
      </div>
      <section className="stop-body" aria-labelledby={`stop-${number}`}>
        <div className="stop-heading">
          <h2 id={`stop-${number}`}>{title}</h2>
          {aside && <span>{aside}</span>}
        </div>
        {children}
      </section>
    </li>
  )
}

export default function App() {
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [showManualDescription, setShowManualDescription] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [lastRequest, setLastRequest] = useState<AnalyzeRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cv, setCv] = useState<CvProfile | null>(null)
  const [cvReading, setCvReading] = useState(false)
  const [cvError, setCvError] = useState('')
  const [openRequirement, setOpenRequirement] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const routeTitle = useRef<HTMLHeadingElement | null>(null)

  const validation = sourceValidation(url, description)
  const canSubmit = !loading && !cvReading && !validation
  const hasUrl = Boolean(url.trim())
  const hasDescription = Boolean(description.trim())
  const sourceWarning = (hasUrl || hasDescription) && validation ? validation : ''

  useEffect(() => () => request.current?.abort(), [])

  useEffect(() => {
    if (result) routeTitle.current?.focus()
  }, [result])

  async function addCvFile(file: File) {
    setCvReading(true)
    setCvError('')
    try {
      setCv(await readCvFile(file))
    } catch (reason) {
      setCvError(
        reason instanceof CvReadError
          ? reason.message
          : 'No pudimos leer tu CV. Prueba con otro PDF o escribe tus habilidades.',
      )
    } finally {
      setCvReading(false)
    }
  }

  function addSkills(value: string) {
    setCvError('')
    try {
      setCv(profileFromSkills(value))
    } catch (reason) {
      setCvError(reason instanceof CvReadError ? reason.message : 'Revisa lo que escribiste.')
    }
  }

  async function analyze(input: AnalyzeRequest) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const startedAt = performance.now()
    setLastRequest(input)
    setLoading(true)
    setError('')
    const timeout = window.setTimeout(() => controller.abort(), 40_000)
    let payload: AnalysisResult | null = null
    let message = ''
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
      payload = parseResult(await response.json())
    } catch (reason) {
      message =
        reason instanceof Error && reason.message && reason.name !== 'AbortError'
          ? reason.message
          : 'La lectura tardó demasiado. Comprueba el enlace o pega la descripción y vuelve a intentarlo.'
    } finally {
      window.clearTimeout(timeout)
    }
    const remaining = 900 - (performance.now() - startedAt)
    if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining))
    if (request.current !== controller) return
    if (payload) {
      setResult(payload)
      setOpenRequirement(payload.requirements.technical[0] ?? null)
    } else setError(message)
    setLoading(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (validation) return setError(validation)
    const common = {
      // The CV is compared in this tab, so its skills are never sent.
      targetRole: 'other' as const,
      profile: { level: 'junior' as const, skills: [] },
    }
    void analyze(
      hasUrl
        ? { ...common, url: normalizeOfferUrl(url.trim()) }
        : { ...common, description: description.trim() },
    )
  }

  function readAnotherOffer() {
    request.current?.abort()
    setUrl('')
    setDescription('')
    setShowManualDescription(false)
    setResult(null)
    setLastRequest(null)
    setError('')
  }

  function updateSource(kind: 'url' | 'description', value: string) {
    if (kind === 'url') {
      setUrl(value)
      if (value.trim()) setDescription('')
    } else {
      setDescription(value)
      if (value.trim()) setUrl('')
    }
    setError('')
  }

  if (loading)
    return (
      <div className="loading-screen">
        <section className="loading" aria-label="Progreso del análisis">
          <h1 role="status" aria-live="polite">
            Estamos armando tu ruta
          </h1>
          <ol>
            {cv && (
              <li className="done">
                <span aria-hidden="true">✓</span>Tu CV está listo en esta pestaña
              </li>
            )}
            <li className="current">
              <span aria-hidden="true" />
              Leyendo la oferta y buscando señales de estafa
            </li>
          </ol>
          <p>Puede tardar hasta un minuto si la oferta es larga.</p>
        </section>
      </div>
    )

  if (result) {
    const facts = [
      result.requirements.level,
      result.requirements.location,
      result.requirements.workMode,
      result.requirements.salary,
    ].filter(Boolean)
    const alerts = result.alerts ?? []
    const { technical, preferred } = result.requirements
    const ownedTechnical = technical.filter((name) => cvSkill(name, cv)).length
    const missingTechnical = technical.filter((name) => !cvSkill(name, cv))
    const missingPreferred = preferred.filter((name) => !cvSkill(name, cv))
    const originalUrl =
      result.input.type === 'url' ? safeExternalUrl(result.input.originalUrl) : null
    const rows = [
      ...technical.map((name) => ({ name, kind: 'Técnico' })),
      ...preferred.map((name) => ({ name, kind: 'Deseable' })),
    ]

    return (
      <div className="page">
        <section className="band route-band">
          <div className="band-inner">
            <header className="topbar">
              <Logo />
              <button className="ghost-action" type="button" onClick={readAnotherOffer}>
                Leer otra oferta
              </button>
            </header>
            <div className="route-title">
              <h1 ref={routeTitle} tabIndex={-1}>
                {offerTitle(result)}
              </h1>
              {facts.length > 0 && <p>{facts.join(' · ')}</p>}
            </div>
            {cv && (
              <div className="cv-strip">
                <span>
                  Comparado con <strong>{cv.label}</strong>. Se borra al cerrar o recargar esta
                  pestaña.
                </span>
                <button className="text-action" type="button" onClick={() => setCv(null)}>
                  Borrar mi CV ahora
                </button>
              </div>
            )}
          </div>
        </section>

        <main className="route">
          <ol className="stops">
            <Stop number={1} title="¿Es confiable?">
              {alerts.length ? (
                <div className="alerts">
                  <p className="alerts-title">
                    Encontramos {alerts.length} {alerts.length === 1 ? 'señal' : 'señales'} de
                    posible estafa
                  </p>
                  <ul>
                    {alerts.map((alert) => (
                      <li key={alert.label}>
                        <strong>{alert.label}</strong>
                        <blockquote>«{alert.text}»</blockquote>
                      </li>
                    ))}
                  </ul>
                  <p>
                    No pagues ni envíes tu DNI hasta confirmar la oferta en la web oficial de la
                    empresa.
                  </p>
                </div>
              ) : (
                <p>
                  No encontramos pedidos de pago ni de datos sensibles en el texto. Eso no garantiza
                  que la oferta sea real: confirma la empresa antes de enviar tus datos.
                </p>
              )}
            </Stop>

            <Stop
              number={2}
              title="Lo que piden"
              aside={
                cv && technical.length
                  ? `Tienes ${ownedTechnical} de ${technical.length} técnicos`
                  : undefined
              }
            >
              {rows.length ? (
                <ul className="requirements">
                  {rows.map(({ name, kind }) => (
                    <Requirement
                      key={name}
                      name={name}
                      kind={kind}
                      quote={evidenceFor(name, result.evidence)}
                      cv={cv}
                      open={openRequirement === name}
                      onToggle={() =>
                        setOpenRequirement((current) => (current === name ? null : name))
                      }
                    />
                  ))}
                </ul>
              ) : (
                <p>No identificamos requisitos técnicos claros en el texto.</p>
              )}
            </Stop>

            <Stop number={3} title="Lo que te falta">
              {cv ? (
                missingTechnical.length || missingPreferred.length ? (
                  <ul className="plain-list">
                    {missingTechnical.length > 0 && (
                      <li>
                        <strong>{formatList(missingTechnical)}</strong>{' '}
                        {missingTechnical.length === 1
                          ? 'es requisito y no lo encontramos en lo que compartiste. Si lo manejas, agrégalo a tu CV; si no, pregunta cuánto se usa en el puesto.'
                          : 'son requisitos y no los encontramos en lo que compartiste. Si manejas alguno, agrégalo a tu CV; si no, pregunta cuánto se usan en el puesto.'}
                      </li>
                    )}
                    {missingPreferred.length > 0 && (
                      <li>
                        <strong>{formatList(missingPreferred)}</strong>{' '}
                        {missingPreferred.length === 1
                          ? 'es deseable. Pregunta si se aprende en el puesto.'
                          : 'son deseables. Pregunta si se aprenden en el puesto.'}
                      </li>
                    )}
                  </ul>
                ) : (
                  <p>Cubres todo lo que detectamos en la oferta.</p>
                )
              ) : (
                <div className="route-cv">
                  <p>
                    Agrega tu CV y te mostramos qué requisitos ya cumples. Se queda en tu navegador.
                  </p>
                  <CvPicker
                    id="route-cv"
                    cv={cv}
                    reading={cvReading}
                    error={cvError}
                    onFile={addCvFile}
                    onSkills={addSkills}
                    onRemove={() => setCv(null)}
                  />
                </div>
              )}
            </Stop>

            <Stop number={4} title="Qué destacar">
              <p>{cv ? personalDemonstration(result, cv) : genericDemonstration(result)}</p>
            </Stop>

            <Stop number={5} title="Postula" last>
              {originalUrl ? (
                <a className="primary-link" href={originalUrl} target="_blank" rel="noreferrer">
                  Ver oferta original <FiExternalLink aria-hidden="true" />
                </a>
              ) : (
                <p>Pegaste esta oferta a mano. Postula desde la página donde la encontraste.</p>
              )}
            </Stop>
          </ol>

          <aside className="route-aside">
            <section>
              <h2>La lectura rápida</h2>
              <p>{quickRead(result)}</p>
            </section>
            <section>
              <h2>Qué te aporta</h2>
              <p>{offerValue(result)}</p>
            </section>
            <section>
              <h2>Tus datos</h2>
              <p>
                No necesitas cuenta. Tu CV se lee en esta pestaña y no se envía a nuestro servidor.
              </p>
            </section>
            {result.limitations.length > 0 && (
              <details className="limits">
                <summary>Alcance de esta lectura</summary>
                <ul>
                  {result.limitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </details>
            )}
          </aside>
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="band">
        <div className="band-inner home">
          <header className="topbar">
            <Logo />
            <span className="brand-product">Ruta para postular</span>
          </header>
          <h1>¿Vas a postular? Pega la oferta.</h1>
          <form className="home-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="offer-url">Enlace de la oferta</label>
              <input
                id="offer-url"
                type="url"
                inputMode="url"
                placeholder="https://empresa.com/carreras/..."
                value={url}
                disabled={hasDescription}
                aria-describedby={sourceWarning ? 'source-warning' : undefined}
                aria-invalid={Boolean(sourceWarning)}
                onChange={(event) => updateSource('url', event.target.value)}
              />
              <button
                className="text-action"
                type="button"
                onClick={() => setShowManualDescription((visible) => !visible)}
              >
                {showManualDescription ? 'Ocultar descripción' : '¿No abre? Pega la descripción.'}
              </button>
              {showManualDescription && (
                <>
                  <label htmlFor="offer-description">Descripción de la oferta</label>
                  <textarea
                    id="offer-description"
                    rows={7}
                    placeholder="Pega aquí el texto de la vacante tal como lo encontraste."
                    value={description}
                    disabled={hasUrl}
                    aria-describedby={sourceWarning ? 'source-warning' : undefined}
                    aria-invalid={Boolean(sourceWarning)}
                    onChange={(event) => updateSource('description', event.target.value)}
                  />
                </>
              )}
              {sourceWarning && (
                <p className="form-warning" id="source-warning" role="alert">
                  {sourceWarning}
                </p>
              )}
            </div>

            <div className="field">
              <span className="field-title">
                Tu CV <small>(opcional, para ver lo que te falta)</small>
              </span>
              <CvPicker
                id="home-cv"
                cv={cv}
                reading={cvReading}
                error={cvError}
                onFile={addCvFile}
                onSkills={addSkills}
                onRemove={() => setCv(null)}
              />
              <p className="field-note">
                Se lee en tu navegador y no se envía a nuestro servidor. Se borra al cerrar o
                recargar esta pestaña. PDF de hasta 2 MB.
              </p>
            </div>

            {error && (
              <div className="form-error" role="alert">
                <p>{error}</p>
                {lastRequest && (
                  <button
                    className="ghost-action"
                    type="button"
                    onClick={() => void analyze(lastRequest)}
                  >
                    Reintentar lectura
                  </button>
                )}
              </div>
            )}

            <button className="primary-action" disabled={!canSubmit} type="submit">
              Ver mi ruta
            </button>
          </form>
        </div>
      </section>

      <main className="preview">
        <h2>Tu ruta tendrá cinco paradas</h2>
        <ol>
          <li>¿Es confiable?</li>
          <li>Lo que piden</li>
          <li>Lo que te falta</li>
          <li>Qué destacar</li>
          <li>Postula</li>
        </ol>
      </main>
    </div>
  )
}
