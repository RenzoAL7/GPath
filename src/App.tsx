import { useEffect, useRef, useState } from 'react'
import {
  FiArrowRight,
  FiArrowUpRight,
  FiBarChart2,
  FiInfo,
  FiMapPin,
} from 'react-icons/fi'

type Role =
  | 'frontend-intern'
  | 'backend-intern'
  | 'data-intern'
  | 'devops-intern'
  | 'qa-intern'
  | 'security-intern'
type Region = 'all' | 'latam'
type Country = 'all' | 'pe' | 'mx' | 'br' | 'cl' | 'co' | 'unknown'
type WorkMode = 'all' | 'remote' | 'hybrid' | 'onsite' | 'unknown'
type Filters = { region: Region; country: Country; workMode: WorkMode }
type Selection = { role: Role; filters: Filters }

type Analysis = {
  role: Role
  label: string
  total: number
  mode: 'demo'
  collectedAt: null
  source: string
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
  }[]
}

const choices: { id: Role; name: string; description: string }[] = [
  { id: 'frontend-intern', name: 'Frontend Intern', description: 'Interfaces y experiencia de usuario' },
  { id: 'backend-intern', name: 'Backend Intern', description: 'APIs y servicios' },
  { id: 'data-intern', name: 'Data Intern', description: 'Datos y consultas' },
  { id: 'devops-intern', name: 'DevOps Intern', description: 'Cloud y automatización' },
  { id: 'qa-intern', name: 'QA Automation Intern', description: 'Pruebas y calidad' },
  { id: 'security-intern', name: 'Cybersecurity Intern', description: 'Seguridad web' },
]

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

export default function App() {
  const [initialSelection] = useState(readSelection)
  const [role, setRole] = useState<Role>(initialSelection.role)
  const [filters, setFilters] = useState<Filters>(initialSelection.filters)
  const [result, setResult] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

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
        payload.mode !== 'demo' ||
        payload.filters?.region !== selectedFilters.region ||
        payload.filters?.country !== selectedFilters.country ||
        payload.filters?.workMode !== selectedFilters.workMode ||
        !Array.isArray(payload.jobs) ||
        !Array.isArray(payload.skills)
      )
        throw new Error('schema')
      if (request.current === controller) setResult(payload)
    } catch {
      if (request.current === controller)
        setError('No se pudieron actualizar los resultados. Comprueba la conexión y vuelve a intentarlo.')
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
          <span className="brand-mark" aria-hidden="true">
            g↗
          </span>
          GPath<span className="brand-detail">Growth Path</span>
        </a>
        <span className="demo-label">
          <span aria-hidden="true" /> Muestra de prueba
        </span>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">PRIMEROS PASOS EN TECNOLOGÍA</p>
          <h1 id="page-title">
            Compara lo que piden
            <br />
            <span>para empezar.</span>
          </h1>
          <p>
            Elige un puesto y una región. Verás qué tecnologías aparecen en la muestra, oferta por
            oferta.
          </p>
        </section>
        <div className="workspace">
          <aside className="role-panel">
            <form
              className="filter-form"
              onSubmit={(event) => {
                event.preventDefault()
                void explore(role, filters)
              }}
            >
              <label className="filter-label" htmlFor="role">
                Puesto de entrada
              </label>
              <select id="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
                {choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </select>
              <p className="selection-hint">
                {choices.find((choice) => choice.id === role)?.description}
              </p>

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
                  setFilters((current) => ({ ...current, workMode: event.target.value as WorkMode }))
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
            <p className="share-note">El enlace conserva el puesto y los filtros seleccionados.</p>
            <div className="sample-note">
              <FiInfo aria-hidden="true" />
              <p>
                <strong>Es una muestra de prueba.</strong> Hay 24 ofertas ficticias para enseñar el
                recorrido. No son vacantes activas.
              </p>
            </div>
            <details className="method">
              <summary>Cómo se cuentan las tecnologías</summary>
              <p>
                Cada tecnología cuenta una vez por oferta, aunque aparezca varias veces. El
                porcentaje se calcula solo sobre las ofertas visibles con tus filtros; no describe
                todo el mercado ni dice qué deberías estudiar.
              </p>
            </details>
          </aside>
          <section className="results-panel" aria-labelledby="results-title" aria-busy={loading}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">TECNOLOGÍAS MENCIONADAS</p>
                <h2 id="results-title">{result?.label || 'Cargando la muestra'}</h2>
              </div>
              <FiBarChart2 className="panel-icon" aria-hidden="true" />
            </div>
            {error && (
              <div className="error-message" role="alert">
                {error}
                {result && ' Conservamos el último resultado disponible.'}
              </div>
            )}
            <p className="result-summary" role="status">
              {loading
                ? 'Consultando la muestra…'
                : result
                  ? `${result.total} ejemplos · ${filterSummary(result.filters)}`
                  : 'Vuelve a intentarlo para consultar la muestra.'}
            </p>
            {result && result.total > 0 && (
              <>
                <div className="chart-head">
                  <span>Tecnología</span>
                  <span>Aparece en</span>
                </div>
                <ol className="skill-chart">
                  {result.skills.slice(0, 8).map((skill, index) => (
                    <li key={skill.name}>
                      <span className="skill-name">
                        {skill.name}
                        {index === 0 && <span className="top-skill">Más frecuente</span>}
                      </span>
                      <div className="skill-measure">
                        <progress
                          max="100"
                          value={skill.percent}
                          aria-label={`${skill.name}: ${skill.count} de ${result.total} ofertas`}
                        />
                        <span>
                          <strong>{skill.percent}%</strong>
                          <small>
                            {skill.count} de {result.total}
                          </small>
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
                <strong>No hay ejemplos con estos filtros.</strong>
                <p>Prueba otra región, país o modalidad para volver a llenar el conteo.</p>
              </div>
            )}
          </section>
        </div>
        {result && result.total > 0 && (
          <section className="jobs-section" aria-labelledby="jobs-title">
            <div className="jobs-heading">
              <div>
                <p className="eyebrow">DE DÓNDE SALE EL CONTEO</p>
                <h2 id="jobs-title">Ofertas de ejemplo que forman el resultado</h2>
              </div>
              <span>
                {result.total} ejemplos · {filterSummary(result.filters)}
              </span>
            </div>
            <div className="jobs-grid">
              {result.jobs.map((job) => (
                <article className="job-card" key={job.id}>
                  <p className="company">{job.company}</p>
                  <h3>{job.title}</h3>
                  <p className="location">
                    <FiMapPin aria-hidden="true" />
                    {job.location}
                  </p>
                  <p className="job-description">{job.description}</p>
                  <ul className="tags" aria-label="Tecnologías mencionadas">
                    {job.skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                  <p className="example-only">Ejemplo ficticio · no admite postulaciones</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer>
        <p>
          GPath <span>Una muestra pequeña para empezar con los pies en la tierra.</span>
        </p>
        <a href="https://docs.greenhouse.io/job-board.html" target="_blank" rel="noreferrer">
          Fuente que evaluaremos después: Greenhouse <FiArrowUpRight aria-hidden="true" />
        </a>
      </footer>
    </div>
  )
}
