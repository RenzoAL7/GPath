import { useEffect, useRef, useState } from 'react'
import { FiArrowRight, FiExternalLink, FiInfo, FiPlus, FiX } from 'react-icons/fi'

type TargetRoleId =
  | 'data-analyst'
  | 'data-engineer'
  | 'backend-developer'
  | 'cloud-devops'
  | 'machine-learning'
  | 'other'
type ProfileLevel = 'practicante' | 'internship' | 'junior'

type Profile = {
  level: ProfileLevel
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

const targetRoles: { id: TargetRoleId; name: string; description: string }[] = [
  { id: 'data-analyst', name: 'Data Analyst', description: 'Análisis, métricas y consultas.' },
  { id: 'data-engineer', name: 'Data Engineer', description: 'Pipelines, datos y plataformas.' },
  { id: 'backend-developer', name: 'Backend Developer', description: 'APIs y servicios.' },
  { id: 'cloud-devops', name: 'Cloud / DevOps', description: 'Cloud y automatización.' },
  {
    id: 'machine-learning',
    name: 'IA / Machine Learning',
    description: 'Modelos y productos de IA.',
  },
  { id: 'other', name: 'Otro', description: 'Otro puesto técnico.' },
]

const levels: { id: ProfileLevel; name: string }[] = [
  { id: 'practicante', name: 'Practicante' },
  { id: 'internship', name: 'Internship' },
  { id: 'junior', name: 'Junior' },
]

const analysisSteps = [
  'Leyendo la oferta.',
  'Extrayendo requisitos.',
  'Comparando con tu perfil.',
  'Generando la explicación.',
]

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

export default function App() {
  const [targetRole, setTargetRole] = useState<TargetRoleId>('data-analyst')
  const [profile, setProfile] = useState<Profile>({
    level: 'junior',
    skills: [],
  })
  const [skillDraft, setSkillDraft] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [lastRequest, setLastRequest] = useState<AnalyzeRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

  const validation = sourceValidation(url, description)
  const canSubmit = !loading && !validation
  const hasUrl = Boolean(url.trim())
  const hasDescription = Boolean(description.trim())
  const hasProfileSkills = Boolean(lastRequest?.profile.skills.length)
  const compatibilityWithTarget = result
    ? !hasProfileSkills || result.compatibility.scope === 'target'
    : false
  const originalUrl =
    result?.input.type === 'url' ? safeExternalUrl(result.input.originalUrl) : null

  useEffect(
    () => () => {
      request.current?.abort()
    },
    [],
  )

  function addSkill() {
    const candidates = skillDraft
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    if (!candidates.length) return
    setProfile((current) => {
      const existing = new Set(current.skills.map((skill) => skill.toLocaleLowerCase()))
      const next = candidates.filter((skill) => !existing.has(skill.toLocaleLowerCase()))
      return { ...current, skills: [...current.skills, ...next].slice(0, 12) }
    })
    setSkillDraft('')
  }

  function removeSkill(skill: string) {
    setProfile((current) => ({
      ...current,
      skills: current.skills.filter((value) => value !== skill),
    }))
  }

  function requestFromForm(): AnalyzeRequest | null {
    if (validation) return null
    const common = { targetRole, profile: { ...profile, skills: [...profile.skills] } }
    return hasUrl
      ? { ...common, url: normalizeOfferUrl(url.trim()) }
      : { ...common, description: description.trim() }
  }

  async function analyze(input: AnalyzeRequest) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLastRequest(input)
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
      if (request.current === controller) setResult(payload)
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

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = requestFromForm()
    if (!input) {
      setError(validation)
      return
    }
    void analyze(input)
  }

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="GPath, inicio">
          GPath<span className="brand-detail">Analizador de ofertas</span>
        </a>
      </header>
      <main>
        <div className="workspace" id="analizador">
          <aside className="role-panel" aria-labelledby="profile-title">
            <h2 id="profile-title">¿Qué puesto buscas?</h2>
            <div className="role-choices" role="group" aria-label="Puesto objetivo">
              {targetRoles.map((choice) => (
                <button
                  key={choice.id}
                  className={`role-choice ${targetRole === choice.id ? 'active' : ''}`}
                  type="button"
                  aria-pressed={targetRole === choice.id}
                  disabled={loading}
                  onClick={() => setTargetRole(choice.id)}
                >
                  <strong>{choice.name}</strong>
                  <span>{choice.description}</span>
                </button>
              ))}
            </div>

            <section className="profile-form" aria-labelledby="profile-details-title">
              <h3 id="profile-details-title">Tu perfil</h3>
              <fieldset>
                <legend>Nivel</legend>
                <div className="segmented three-options" role="group" aria-label="Nivel">
                  {levels.map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      className={profile.level === level.id ? 'active' : ''}
                      aria-pressed={profile.level === level.id}
                      disabled={loading}
                      onClick={() => setProfile((current) => ({ ...current, level: level.id }))}
                    >
                      {level.name}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="skills-field">
                <label htmlFor="skills">Habilidades actuales</label>
                <p>Agrega tecnologías o conocimientos que ya manejas.</p>
                <div className="skill-input-row">
                  <input
                    id="skills"
                    value={skillDraft}
                    disabled={loading || profile.skills.length >= 12}
                    placeholder="Ej. Python, SQL"
                    onChange={(event) => setSkillDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault()
                        addSkill()
                      }
                    }}
                    onBlur={addSkill}
                  />
                  <button
                    className="add-skill-button"
                    type="button"
                    disabled={loading || !skillDraft.trim() || profile.skills.length >= 12}
                    onClick={addSkill}
                  >
                    <FiPlus aria-hidden="true" /> <span>Agregar</span>
                  </button>
                </div>
                {profile.skills.length > 0 && (
                  <ul className="skill-chips" aria-label="Habilidades agregadas">
                    {profile.skills.map((skill) => (
                      <li key={skill}>
                        {skill}
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => removeSkill(skill)}
                          aria-label={`Eliminar ${skill}`}
                        >
                          <FiX aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </aside>

          <section className="analyzer-panel" aria-labelledby="analyzer-title" aria-busy={loading}>
            <div className="panel-heading">
              <div>
                <h2 id="analyzer-title">Analizador de ofertas</h2>
              </div>
            </div>

            <form className="analyze-form" onSubmit={submit}>
              <label className="field-label" htmlFor="offer-url">
                Pega el enlace público de la oferta
              </label>
              <input
                id="offer-url"
                type="url"
                inputMode="url"
                placeholder="https://empresa.com/carreras/..."
                value={url}
                disabled={loading || hasDescription}
                aria-describedby="source-help"
                onChange={(event) => {
                  const value = event.target.value
                  setUrl(value)
                  if (value.trim()) setDescription('')
                }}
              />
              <p className="source-separator" aria-hidden="true">
                o
              </p>
              <label className="field-label" htmlFor="offer-description">
                Si no pudimos leer el enlace, pega aquí la descripción de la oferta.
              </label>
              <textarea
                id="offer-description"
                rows={7}
                placeholder="Pega el texto de la vacante tal como lo encontraste."
                value={description}
                disabled={loading || hasUrl}
                aria-describedby="source-help"
                onChange={(event) => {
                  const value = event.target.value
                  setDescription(value)
                  if (value.trim()) setUrl('')
                }}
              />
              <p className={`source-help ${validation ? 'has-warning' : ''}`} id="source-help">
                {validation || 'Usa una sola fuente por análisis.'}
              </p>
              <button className="analyze-button" disabled={!canSubmit} type="submit">
                {loading ? 'Analizando oferta…' : 'Analizar oferta'}
                <FiArrowRight aria-hidden="true" />
              </button>
            </form>

            {loading && (
              <section className="progress-panel" aria-label="Progreso del análisis">
                <p role="status" aria-live="polite">
                  Analizando la oferta. Puede tardar un momento.
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
                {lastRequest && !loading && (
                  <button
                    className="retry-button"
                    type="button"
                    onClick={() => void analyze(lastRequest)}
                  >
                    Reintentar análisis
                  </button>
                )}
              </div>
            )}

            {!result && !loading && !error && (
              <div className="empty-state">
                <strong>El análisis aparecerá aquí.</strong>
                <p>
                  Elige tu puesto objetivo y agrega un enlace público o la descripción de la oferta.
                </p>
              </div>
            )}

            {result && (
              <section className="analysis-result" aria-labelledby="compatibility-title">
                <div className="result-topline">
                  <span>
                    {result.input.type === 'url'
                      ? 'Oferta leída desde el enlace'
                      : 'Descripción pegada por ti'}
                  </span>
                  <span>{result.targetRole.label}</span>
                </div>
                <div className="compatibility-heading">
                  <div>
                    <p className="section-label">Compatibilidad</p>
                    <h2 id="compatibility-title">
                      {compatibilityWithTarget
                        ? 'Compatibilidad con el puesto objetivo'
                        : 'Compatibilidad con tu perfil'}
                    </h2>
                    <p className="compatibility-label">{result.compatibility.label}</p>
                    <p className="recommendation">{result.compatibility.recommendation}</p>
                  </div>
                  <div
                    className="score-card"
                    aria-label={`Compatibilidad ${Math.round(result.compatibility.score)} de 100`}
                  >
                    <strong>{Math.round(result.compatibility.score)}</strong>
                    <span>de 100</span>
                    <progress
                      max="100"
                      value={Math.max(0, Math.min(100, result.compatibility.score))}
                    />
                  </div>
                </div>

                {compatibilityWithTarget && (
                  <div className="profile-warning">
                    <FiInfo aria-hidden="true" />
                    <p>
                      Perfil incompleto: agrega tus habilidades actuales para calcular una
                      compatibilidad personal.
                    </p>
                  </div>
                )}

                <section className="factor-section" aria-labelledby="factors-title">
                  <h3 id="factors-title">Cómo se calculó</h3>
                  <p>
                    El puntaje es orientativo y se calcula en el backend con factores visibles; la
                    explicación no decide el puntaje.
                  </p>
                  <ul className="factor-list">
                    {result.factors.map((factor) => (
                      <li key={factor.id}>
                        <div>
                          <strong>{factor.label}</strong>
                          <span>{factor.detail}</span>
                        </div>
                        <p>
                          <b>
                            {factor.score === null
                              ? 'No evaluado'
                              : `${Math.round(factor.score)} / 100`}
                          </b>
                          <span>
                            Peso {Math.round(factor.weight)}% · aporta{' '}
                            {Math.round(factor.contribution)} puntos
                          </span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>

                <div className="result-columns">
                  <section aria-labelledby="requirements-title">
                    <h3 id="requirements-title">Ellos piden</h3>
                    <h4>Técnicas</h4>
                    {listOrEmpty(
                      result.requirements.technical,
                      'No se identificaron requisitos técnicos claros.',
                    )}
                    <h4>Deseables</h4>
                    {listOrEmpty(
                      result.requirements.preferred,
                      'No se identificaron requisitos deseables claros.',
                    )}
                  </section>
                  <section aria-labelledby="match-title">
                    <h3 id="match-title">Tú cumples</h3>
                    {listOrEmpty(
                      result.profile.matched,
                      'No se identificaron coincidencias personales.',
                    )}
                    <h3 className="gap-heading">Te falta</h3>
                    {listOrEmpty(result.profile.gaps, 'No se identificaron brechas concretas.')}
                  </section>
                </div>

                <section className="offer-details" aria-labelledby="details-title">
                  <h3 id="details-title">Lo que indica la oferta</h3>
                  <dl>
                    <div>
                      <dt>Nivel detectado</dt>
                      <dd>{result.requirements.level || 'No indicado'}</dd>
                    </div>
                    <div>
                      <dt>Ubicación</dt>
                      <dd>{result.requirements.location || 'No indicada'}</dd>
                    </div>
                    <div>
                      <dt>Modalidad</dt>
                      <dd>{result.requirements.workMode || 'No indicada'}</dd>
                    </div>
                    {result.requirements.salary && (
                      <div>
                        <dt>Salario</dt>
                        <dd>{result.requirements.salary}</dd>
                      </div>
                    )}
                  </dl>
                </section>

                <section className="explanation-section" aria-labelledby="explanation-title">
                  <h3 id="explanation-title">Explicación</h3>
                  <p>{result.explanation}</p>
                </section>

                <section className="evidence-section" aria-labelledby="evidence-title">
                  <h3 id="evidence-title">Evidencias de la oferta</h3>
                  {result.evidence.length ? (
                    <ul>
                      {result.evidence.map((evidence) => (
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
        </div>
      </main>
      <footer>
        <p>
          GPath <span>Analizador de ofertas</span>
        </p>
      </footer>
    </div>
  )
}
