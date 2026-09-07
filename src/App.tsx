import { useEffect, useRef, useState } from 'react'
import { FiArrowRight, FiCheck, FiInfo, FiMapPin } from 'react-icons/fi'
type Role = 'data' | 'backend' | 'devops'
type Analysis = {
  role: Role
  label: string
  total: number
  mode: 'demo'
  collectedAt: null
  skills: { name: string; count: number; percent: number }[]
  jobs: {
    id: string
    company: string
    title: string
    location: string
    description: string
    skills: string[]
  }[]
}
const choices: { id: Role; name: string; description: string }[] = [
  { id: 'data', name: 'Data Engineer', description: 'Datos, pipelines y calidad' },
  { id: 'backend', name: 'Backend', description: 'APIs, servicios y lógica' },
  { id: 'devops', name: 'DevOps', description: 'Cloud, despliegue y operación' },
]
export default function App() {
  const [role, setRole] = useState<Role>('data')
  const [result, setResult] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  async function explore(selected: Role) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(`/api/jobs?role=${selected}`, { signal: controller.signal })
      if (!response.ok) throw new Error('api')
      const payload: Analysis = await response.json()
      if (
        payload.role !== selected ||
        payload.mode !== 'demo' ||
        !Array.isArray(payload.jobs) ||
        !Array.isArray(payload.skills)
      )
        throw new Error('schema')
      if (request.current === controller) setResult(payload)
    } catch {
      if (request.current === controller)
        setError('No se pudieron cargar los requisitos. Inténtalo de nuevo.')
    } finally {
      clearTimeout(timeout)
      if (request.current === controller) setLoading(false)
    }
  }
  useEffect(() => {
    void explore('data')
    return () => {
      request.current?.abort()
      request.current = null
    }
  }, [])
  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="GPath, inicio">
          <img className="brand-mark" src="/gpath-mark.svg" width="34" height="34" alt="" />
          GPath<span className="brand-detail">Growth Path</span>
        </a>
        <span className="demo-label">
          <span aria-hidden="true" /> Demo
        </span>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <h1 id="page-title">Requisitos por puesto</h1>
        </section>
        <div className="workspace">
          <aside className="role-panel">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void explore(role)
              }}
            >
              <fieldset>
                <legend>Puesto</legend>
                {choices.map((choice) => (
                  <label
                    key={choice.id}
                    className={`role-choice ${role === choice.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={choice.id}
                      checked={role === choice.id}
                      onChange={() => setRole(choice.id)}
                    />
                    <span>
                      <strong>{choice.name}</strong>
                      <small>{choice.description}</small>
                    </span>
                    {role === choice.id && <FiCheck aria-hidden="true" />}
                  </label>
                ))}
              </fieldset>
              <button className="explore-button" disabled={loading} type="submit">
                {loading ? 'Cargando…' : 'Ver requisitos'}
                <FiArrowRight aria-hidden="true" />
              </button>
            </form>
            <div className="sample-note">
              <FiInfo aria-hidden="true" />
              <p>
                <strong>Datos de ejemplo.</strong> Las 12 ofertas son ficticias. No son vacantes
                disponibles para postular.
              </p>
            </div>
            <details className="method">
              <summary>Cómo se calcula</summary>
              <p>
                Cada tecnología cuenta una vez por oferta, aunque se mencione varias veces. El
                porcentaje se calcula sobre las ofertas del puesto elegido, no sobre todo el
                mercado.
              </p>
            </details>
          </aside>
          <section className="results-panel" aria-labelledby="results-title" aria-busy={loading}>
            <div className="panel-heading">
              <div>
                <h2 id="results-title">{result?.label || 'Requisitos'}</h2>
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
                ? 'Cargando requisitos…'
                : result
                  ? `${result.total} ofertas de ejemplo`
                  : 'Pulsa «Ver requisitos» para reintentar.'}
            </p>
            {result && (
              <>
                <div className="chart-head">
                  <span>Tecnología</span>
                  <span>Ofertas que la mencionan</span>
                </div>
                <ol className="skill-chart">
                  {result.skills.slice(0, 8).map((skill) => (
                    <li key={skill.name}>
                      <span className="skill-name">{skill.name}</span>
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
                {result.total === 0 && <p>No hay ofertas para este puesto en la muestra.</p>}
                <p className="chart-caption">
                  Una misma oferta puede mencionar varias tecnologías.
                </p>
              </>
            )}
          </section>
        </div>
        {result && (
          <section className="jobs-section" aria-labelledby="jobs-title">
            <div className="jobs-heading">
              <div>
                <h2 id="jobs-title">Ofertas de ejemplo</h2>
              </div>
              <span>
                {result.total} ejemplos · {result.label}
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
                  <p className="example-only">Oferta ficticia</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer>
        <p>
          GPath <span>Growth Path</span>
        </p>
      </footer>
    </div>
  )
}
