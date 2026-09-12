import { useEffect, useRef, useState } from 'react'
import { FiArrowRight, FiExternalLink, FiInfo, FiMapPin } from 'react-icons/fi'

type Role =
  | 'frontend-intern'
  | 'backend-intern'
  | 'data-intern'
  | 'devops-intern'
  | 'qa-intern'
  | 'security-intern'
  | 'data-engineer-intern'
  | 'data-engineering-intern'
  | 'data-infrastructure-intern'
  | 'data-platform-intern'
  | 'cloud-engineer-intern'
  | 'cloud-infrastructure-intern'
  | 'platform-engineer-intern'
  | 'infrastructure-engineer-intern'
  | 'mlops-intern'
  | 'machine-learning-engineer-intern'
  | 'ml-engineer-intern'
  | 'ai-engineer-intern'
  | 'software-engineer-intern-data'
  | 'software-engineer-intern-infrastructure'
  | 'software-engineer-intern-backend'
  | 'sre-intern'
  | 'site-reliability-engineer-intern'
  | 'big-data-intern'
  | 'analytics-engineer-intern'
  | 'dataops-intern'
type Region = 'all' | 'latam'
type Country = 'all' | 'pe' | 'mx' | 'br' | 'cl' | 'co' | 'unknown'
type WorkMode = 'all' | 'remote' | 'hybrid' | 'onsite' | 'unknown'
type Filters = { region: Region; country: Country; workMode: WorkMode }
type Selection = { role: Role; filters: Filters }

type Analysis = {
  role: Role
  label: string
  total: number
  mode: 'live' | 'demo'
  collectedAt: string | null
  source: string
  sourceCount?: number
  sourceNames?: string[]
  sampleLimit?: number
  partial?: boolean
  filters: Filters
  skills: { name: string; count: number; percent: number }[]
  jobs: {
    id: string
    company: string
    title: string
    location: string
    description: string
    skills: string[]
    region: 'latam' | 'unknown'
    country: Exclude<Country, 'all' | 'unknown'> | null
    city: string | null
    workMode: Exclude<WorkMode, 'all'>
    url?: string
    source?: string
    updatedAt?: string | null
  }[]
}

const familyChoices: { id: Role; name: string; description: string }[] = [
  {
    id: 'frontend-intern',
    name: 'Frontend Intern',
    description: 'Interfaces y experiencia de usuario',
  },
  { id: 'backend-intern', name: 'Backend Intern', description: 'APIs y servicios' },
  { id: 'data-intern', name: 'Data Intern', description: 'Datos y consultas' },
  { id: 'devops-intern', name: 'DevOps Intern', description: 'Cloud y automatización' },
  { id: 'qa-intern', name: 'QA Automation Intern', description: 'Pruebas y calidad' },
  { id: 'security-intern', name: 'Cybersecurity Intern', description: 'Seguridad web' },
]

const specificChoices: { id: Role; name: string; description: string }[] = [
  {
    id: 'data-engineer-intern',
    name: 'Data Engineer Intern',
    description: 'Pipelines y almacenes de datos',
  },
  {
    id: 'data-engineering-intern',
    name: 'Data Engineering Intern',
    description: 'Procesamiento y calidad de datos',
  },
  {
    id: 'data-infrastructure-intern',
    name: 'Data Infrastructure Intern',
    description: 'Plataformas para mover y servir datos',
  },
  {
    id: 'data-platform-intern',
    name: 'Data Platform Intern',
    description: 'Servicios y herramientas para datos',
  },
  {
    id: 'cloud-engineer-intern',
    name: 'Cloud Engineer Intern',
    description: 'Servicios cloud y automatización',
  },
  {
    id: 'cloud-infrastructure-intern',
    name: 'Cloud Infrastructure Intern',
    description: 'Redes, compute y plataformas cloud',
  },
  {
    id: 'platform-engineer-intern',
    name: 'Platform Engineer Intern',
    description: 'Plataformas internas y developer tooling',
  },
  {
    id: 'infrastructure-engineer-intern',
    name: 'Infrastructure Engineer Intern',
    description: 'Infraestructura y sistemas',
  },
  { id: 'mlops-intern', name: 'MLOps Intern', description: 'Pipelines y operación de modelos' },
  {
    id: 'machine-learning-engineer-intern',
    name: 'Machine Learning Engineer Intern',
    description: 'Modelos y sistemas de machine learning',
  },
  { id: 'ml-engineer-intern', name: 'ML Engineer Intern', description: 'Modelos y sistemas de ML' },
  {
    id: 'ai-engineer-intern',
    name: 'AI Engineer Intern',
    description: 'Aplicaciones y sistemas de IA',
  },
  {
    id: 'software-engineer-intern-data',
    name: 'Software Engineer Intern Data',
    description: 'Software para datos',
  },
  {
    id: 'software-engineer-intern-infrastructure',
    name: 'Software Engineer Intern Infrastructure',
    description: 'Software para infraestructura',
  },
  {
    id: 'software-engineer-intern-backend',
    name: 'Software Engineer Intern Backend',
    description: 'Servicios y APIs',
  },
  { id: 'sre-intern', name: 'SRE Intern', description: 'Fiabilidad y operación' },
  {
    id: 'site-reliability-engineer-intern',
    name: 'Site Reliability Engineer Intern',
    description: 'Fiabilidad y operación',
  },
  {
    id: 'big-data-intern',
    name: 'Big Data Intern',
    description: 'Procesamiento de grandes volúmenes',
  },
  {
    id: 'analytics-engineer-intern',
    name: 'Analytics Engineer Intern',
    description: 'Modelado y análisis',
  },
  { id: 'dataops-intern', name: 'DataOps Intern', description: 'Automatización de datos' },
]

const choices = [...familyChoices, ...specificChoices]

const countryLabels: Record<Country, string> = {
  all: 'Todos',
  pe: 'Perú',
  mx: 'México',
  br: 'Brasil',
  cl: 'Chile',
  co: 'Colombia',
  unknown: 'Ubicación desconocida',
}
const workModeLabels: Record<WorkMode, string> = {
  all: 'Todas',
  remote: 'Remoto',
  hybrid: 'Híbrido',
  onsite: 'Presencial',
  unknown: 'Sin modalidad indicada',
}
const countries: Country[] = ['all', 'pe', 'mx', 'br', 'cl', 'co', 'unknown']
const workModes: WorkMode[] = ['all', 'remote', 'hybrid', 'onsite', 'unknown']
const defaultFilters: Filters = { region: 'all', country: 'all', workMode: 'all' }

function readSelection(): Selection {
  const params = new URLSearchParams(window.location.search)
  const roleValue = params.get('role')
  const role = choices.some((choice) => choice.id === roleValue)
    ? (roleValue as Role)
    : 'data-intern'
  const countryValue = params.get('country') as Country | null
  const workModeValue = params.get('workMode') as WorkMode | null
  return {
    role,
    filters: {
      region: params.get('region') === 'latam' ? 'latam' : 'all',
      country: countryValue && countries.includes(countryValue) ? countryValue : 'all',
      workMode: workModeValue && workModes.includes(workModeValue) ? workModeValue : 'all',
    },
  }
}

function filterSummary(filters: Filters) {
  const values = [
    filters.region === 'latam' ? 'LATAM' : null,
    filters.country !== 'all' ? countryLabels[filters.country] : null,
    filters.workMode !== 'all' ? workModeLabels[filters.workMode] : null,
  ].filter(Boolean)
  return values.length ? values.join(' · ') : 'Todas las ubicaciones'
}

function formatDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return null
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function App() {
  const [initialSelection] = useState(readSelection)
  const [role, setRole] = useState<Role>(initialSelection.role)
  const [filters, setFilters] = useState<Filters>(initialSelection.filters)
  const [result, setResult] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [technology, setTechnology] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const live = result?.mode === 'live'
  const statusText = live ? 'Ofertas públicas' : result ? 'Demo local' : 'Consultando'
  const pending =
    result &&
    (role !== result.role ||
      Object.keys(filters).some(
        (key) => filters[key as keyof Filters] !== result.filters[key as keyof Filters],
      ))
  const visibleJobs =
    result?.jobs.filter((job) => !technology || job.skills.includes(technology)) || []

  async function explore(selectedRole: Role, selectedFilters: Filters) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ role: selectedRole, ...selectedFilters })
    window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`)
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(`/api/jobs?${query.toString()}`, { signal: controller.signal })
      if (!response.ok) throw new Error('api')
      const payload: Analysis = await response.json()
      if (
        payload.role !== selectedRole ||
        !['live', 'demo'].includes(payload.mode) ||
        payload.filters?.region !== selectedFilters.region ||
        payload.filters?.country !== selectedFilters.country ||
        payload.filters?.workMode !== selectedFilters.workMode ||
        !Array.isArray(payload.jobs) ||
        !Array.isArray(payload.skills)
      )
        throw new Error('schema')
      if (request.current === controller) {
        setResult(payload)
        setTechnology(null)
      }
    } catch {
      if (request.current === controller)
        setError(
          'No se pudieron actualizar las ofertas. Comprueba la conexión y vuelve a intentarlo.',
        )
    } finally {
      clearTimeout(timeout)
      if (request.current === controller) setLoading(false)
    }
  }

  useEffect(() => {
    void explore(initialSelection.role, initialSelection.filters)
    return () => {
      request.current?.abort()
      request.current = null
    }
  }, [])

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="GPath, inicio">
          <img className="brand-mark" src="/gpath-mark.svg" width="34" height="34" alt="" />
          GPath<span className="brand-detail">Growth Path</span>
        </a>
        <nav className="top-nav" aria-label="Secciones">
          <a href="#explorar">Explorar</a>
          <a href="#ofertas">Ofertas</a>
          <a href="#metodo">Método</a>
        </nav>
        <span className={`status-label ${live ? 'is-live' : 'is-demo'}`}>
          <span aria-hidden="true" /> {statusText}
        </span>
      </header>
      <main>
        <h1 className="sr-only">Tecnologías y ofertas de prácticas</h1>
        <div className="workspace" id="explorar">
          <aside className="role-panel">
            <form
              className="filter-form"
              onSubmit={(event) => {
                event.preventDefault()
                void explore(role, filters)
              }}
            >
              <label className="filter-label" htmlFor="role">
                Puesto
              </label>
              <select
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                <optgroup label="Familias">
                  {familyChoices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Puestos específicos">
                  {specificChoices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                </optgroup>
              </select>

              <fieldset className="region-field">
                <legend>Región</legend>
                <div className="segmented" role="group" aria-label="Región">
                  {(['all', 'latam'] as Region[]).map((value) => (
                    <button
                      key={value}
                      className={filters.region === value ? 'active' : ''}
                      aria-pressed={filters.region === value}
                      type="button"
                      onClick={() => setFilters((current) => ({ ...current, region: value }))}
                    >
                      {value === 'all' ? 'Todas' : 'LATAM'}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="filter-label" htmlFor="country">
                País o cobertura
              </label>
              <select
                id="country"
                value={filters.country}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, country: event.target.value as Country }))
                }
              >
                {countries.map((value) => (
                  <option key={value} value={value}>
                    {countryLabels[value]}
                  </option>
                ))}
              </select>

              <label className="filter-label" htmlFor="work-mode">
                Modalidad
              </label>
              <select
                id="work-mode"
                value={filters.workMode}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    workMode: event.target.value as WorkMode,
                  }))
                }
              >
                {workModes.map((value) => (
                  <option key={value} value={value}>
                    {workModeLabels[value]}
                  </option>
                ))}
              </select>

              <button className="explore-button" disabled={loading} type="submit">
                {loading ? 'Actualizando…' : 'Ver tecnologías'}
                <FiArrowRight aria-hidden="true" />
              </button>
            </form>
            {pending && (
              <p className="pending-selection" role="status">
                Hay filtros pendientes de aplicar. Viendo: {result.label} ·{' '}
                {filterSummary(result.filters)}.
              </p>
            )}
            <div className="sample-note">
              <FiInfo aria-hidden="true" />
              <p>
                {live && result ? (
                  <>
                    <strong>Ofertas públicas.</strong> Se consultaron {result.sourceCount || 0}{' '}
                    fuentes
                    {formatDate(result.collectedAt) &&
                      ` · actualizado ${formatDate(result.collectedAt)}`}
                    {result.partial && ' · una fuente no respondió'}.
                  </>
                ) : result ? (
                  <>
                    <strong>Demo local.</strong> Hay 24 ofertas ficticias para probar el recorrido;
                    no son vacantes activas.
                  </>
                ) : (
                  <>
                    <strong>Consultando ofertas.</strong> Espera un momento para ver el origen de
                    los datos.
                  </>
                )}
              </p>
            </div>
            <details className="method" id="metodo">
              <summary>Cómo se cuentan las tecnologías</summary>
              <p>
                {live
                  ? `Cada tecnología cuenta una vez por oferta, aunque se mencione varias veces. La muestra se limita a ${result?.sampleLimit || 6} ofertas por fuente y no representa todo el mercado.`
                  : 'Cada tecnología cuenta una vez por oferta, aunque aparezca varias veces. El modo demo usa una muestra fija y no representa todo el mercado.'}
              </p>
            </details>
          </aside>
          <section className="results-panel" aria-labelledby="results-title" aria-busy={loading}>
            <div className="panel-heading">
              <div>
                <p className="section-label">Tecnologías mencionadas</p>
                <h2 id="results-title">{result?.label || 'Cargando la muestra'}</h2>
              </div>
            </div>
            {error && (
              <div className="error-message" role="alert">
                {error}
                {result && ' Se muestra el resultado anterior.'}
              </div>
            )}
            <p className="result-summary" role="status">
              {loading
                ? 'Consultando ofertas…'
                : result
                  ? `${result.total} ${live ? 'ofertas encontradas' : 'ejemplos'} · ${filterSummary(result.filters)}`
                  : 'Vuelve a intentarlo para consultar las ofertas.'}
            </p>
            {result && result.total > 0 && (
              <>
                <div className="chart-head">
                  <span>Tecnología</span>
                  <span>Aparece en</span>
                </div>
                <ol className="skill-chart">
                  {result.skills.slice(0, 8).map((skill) => (
                    <li key={skill.name}>
                      <button
                        className="skill-name"
                        type="button"
                        aria-pressed={technology === skill.name}
                        aria-controls="jobs-list"
                        onClick={() => setTechnology(technology === skill.name ? null : skill.name)}
                      >
                        {skill.name}
                        <FiArrowRight aria-hidden="true" />
                      </button>
                      <div className="skill-measure">
                        <progress
                          max="100"
                          value={skill.percent}
                          aria-label={`${skill.name}: ${skill.count} de ${result.total} ofertas`}
                        />
                        <span>
                          <strong>
                            {skill.count} de {result.total}
                          </strong>
                          <small>{skill.percent}%</small>
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="chart-caption">
                  Los porcentajes no tienen que sumar 100%: una oferta puede mencionar varias
                  tecnologías.
                </p>
              </>
            )}
            {result && result.total === 0 && (
              <div className="empty-state">
                <strong>No hay ofertas con estos filtros.</strong>
                <p>Prueba otra región, país o modalidad para volver a llenar el conteo.</p>
              </div>
            )}
          </section>
          {result && result.total > 0 && (
            <section className="jobs-section" id="ofertas" aria-labelledby="jobs-title">
              <div className="jobs-heading">
                <div>
                  <h2 id="jobs-title">{live ? 'Ofertas consultadas' : 'Ofertas de ejemplo'}</h2>
                </div>
                <span>
                  {visibleJobs.length} {live ? 'ofertas' : 'ejemplos'} ·{' '}
                  {filterSummary(result.filters)}
                </span>
              </div>
              {technology && (
                <button className="clear-filter" type="button" onClick={() => setTechnology(null)}>
                  {technology} · Quitar filtro ×
                </button>
              )}
              <div className="jobs-grid" id="jobs-list" aria-live="polite">
                {visibleJobs.map((job) => (
                  <article className="job-card" key={job.id}>
                    <p className="company">{job.company}</p>
                    <h3>{job.title}</h3>
                    <p className="location">
                      <FiMapPin aria-hidden="true" />
                      {job.location}
                    </p>
                    <details className="job-detail">
                      <summary>Descripción del puesto</summary>
                      <p className="job-description">{job.description}</p>
                    </details>
                    <ul className="tags" aria-label="Tecnologías mencionadas">
                      {job.skills.map((skill) => (
                        <li key={skill}>{skill}</li>
                      ))}
                    </ul>
                    <div className="job-meta">
                      {job.url && (
                        <a className="job-link" href={job.url} target="_blank" rel="noreferrer">
                          Ver oferta original <FiExternalLink aria-hidden="true" />
                        </a>
                      )}
                      <p className="example-only">
                        {live
                          ? [
                              job.source,
                              formatDate(job.updatedAt) &&
                                `actualizada ${formatDate(job.updatedAt)}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : 'Oferta ficticia'}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <footer>
        <p>
          GPath <span>Growth Path</span>
        </p>
      </footer>
    </div>
  )
}
