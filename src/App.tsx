import { useEffect, useRef, useState } from 'react'
import {
  FiArrowRight,
  FiArrowUpRight,
  FiBarChart2,
  FiCheck,
  FiInfo,
  FiMapPin,
} from 'react-icons/fi'
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
        setError('No pudimos consultar los requisitos. Revisa la conexión y vuelve a explorar.')
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
          <span className="brand-mark" aria-hidden="true">
            g↗
          </span>
          GPath<span className="brand-detail">Growth Path</span>
        </a>
        <span className="demo-label">
          <span aria-hidden="true" /> Primera demo
        </span>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">EL SIGUIENTE PASO, CON CONTEXTO</p>
          <h1 id="page-title">
            ¿Qué piden para
            <br />
            <span>el puesto que buscas?</span>
          </h1>
          <p>
            Explora qué tecnologías se repiten en las ofertas.
            <br className="desktop-break" /> Sin subir tu CV. Sin crear una cuenta.
          </p>
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
                <legend>Elige un puesto</legend>
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
                {loading ? 'Consultando…' : 'Explorar requisitos'}
                <FiArrowRight aria-hidden="true" />
              </button>
            </form>
            <div className="sample-note">
              <FiInfo aria-hidden="true" />
              <p>
                <strong>Estás viendo una demo.</strong> Usamos 12 ofertas ficticias para mostrar
                cómo funciona. No son vacantes activas.
              </p>
            </div>
            <details className="method">
              <summary>¿Cómo se cuentan?</summary>
              <p>
                Cada tecnología cuenta una vez por oferta, aunque se mencione varias veces. El
                porcentaje se calcula sobre las ofertas del puesto elegido. No mide todo el mercado
                ni recomienda qué estudiar.
              </p>
            </details>
          </aside>
          <section className="results-panel" aria-labelledby="results-title" aria-busy={loading}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">TECNOLOGÍAS QUE SE REPITEN</p>
                <h2 id="results-title">{result?.label || 'Preparando la muestra'}</h2>
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
                  ? `${result.total} ofertas de ejemplo · conteos calculados por la API`
                  : 'Pulsa «Explorar requisitos» para volver a intentar.'}
            </p>
            {result && (
              <>
                <div className="chart-head">
                  <span>Tecnología</span>
                  <span>Presente en las ofertas</span>
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
                {result.total === 0 && <p>No hay ofertas para este puesto en la muestra.</p>}
                <p className="chart-caption">
                  Una oferta puede mencionar varias tecnologías; los porcentajes no tienen que sumar
                  100%.
                </p>
              </>
            )}
          </section>
        </div>
        {result && (
          <section className="jobs-section" aria-labelledby="jobs-title">
            <div className="jobs-heading">
              <div>
                <p className="eyebrow">DE DÓNDE SALE EL RESULTADO</p>
                <h2 id="jobs-title">Mira las ofertas de la muestra</h2>
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
                  <p className="example-only">Ejemplo ficticio · no admite postulaciones</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer>
        <p>
          GPath <span>Un poco más de contexto para tu próximo paso.</span>
        </p>
        <a href="https://docs.greenhouse.io/job-board.html" target="_blank" rel="noreferrer">
          Fuente prevista para la siguiente etapa: Greenhouse <FiArrowUpRight aria-hidden="true" />
        </a>
      </footer>
    </div>
  )
}
