import { demoJobs } from './demo-jobs.mjs'

export const roles = {
  'frontend-intern': 'Frontend Intern',
  'backend-intern': 'Backend Intern',
  'data-intern': 'Data Intern',
  'devops-intern': 'DevOps Intern',
  'qa-intern': 'QA Automation Intern',
  'security-intern': 'Cybersecurity Intern',
}

const entryLevel = /\b(?:intern(?:ship)?|practicante)\b/i
export const roleMatchers = {
  'frontend-intern': /\b(?:frontend|front-end|web|ui)\b/i,
  'backend-intern': /\b(?:backend|back-end|server[- ]side|api)\b/i,
  'data-intern': /\b(?:data|analytics|etl|machine learning)\b/i,
  'devops-intern': /\b(?:devops|dev ops|platform|site reliability|\bsre\b|cloud|infrastructure)\b/i,
  'qa-intern': /\b(?:qa|quality assurance|test(?:ing)?|automation)\b/i,
  'security-intern': /\b(?:cybersecurity|cyber security|security|appsec|application security)\b/i,
}

export const filterOptions = {
  region: { all: 'Todas', latam: 'LATAM' },
  country: {
    all: 'Todos',
    pe: 'Perú',
    mx: 'México',
    br: 'Brasil',
    cl: 'Chile',
    co: 'Colombia',
    unknown: 'Ubicación desconocida',
  },
  workMode: {
    all: 'Todas',
    remote: 'Remoto',
    hybrid: 'Híbrido',
    onsite: 'Presencial',
    unknown: 'Sin modalidad indicada',
  },
}

export const defaultJobFilters = {
  region: 'all',
  country: 'all',
  workMode: 'all',
}

const rules = [
  ['React', /\breact(?:\.js)?\b/i],
  ['JavaScript', /\bjavascript\b/i],
  ['TypeScript', /\btypescript\b/i],
  ['HTML/CSS', /\b(?:html|css)\b/i],
  ['Python', /\bpython\b/i],
  ['SQL', /\bsql\b/i],
  ['PostgreSQL', /\bpostgres(?:ql)?\b/i],
  ['MySQL', /\bmysql\b/i],
  ['AWS', /\baws\b/i],
  ['GCP', /\b(?:gcp|google cloud)\b/i],
  ['Azure', /\bazure\b/i],
  ['Docker', /\bdocker\b/i],
  ['Kubernetes', /\b(?:kubernetes|k8s|k3s)\b/i],
  ['Terraform', /\bterraform\b/i],
  ['Git', /\bgit\b/i],
  ['CI/CD', /\bci\s*\/?\s*cd\b|continuous integration|continuous delivery/i],
  ['Linux', /\blinux\b/i],
  ['Java', /\bjava\b/i],
  ['Node.js', /\bnode(?:\.js|js)\b/i],
  ['Redis', /\bredis\b/i],
  ['Kafka', /\bkafka\b/i],
  ['Spark', /\bspark\b/i],
  ['Airflow', /\bairflow\b/i],
  ['Snowflake', /\bsnowflake\b/i],
  ['Playwright', /\bplaywright\b/i],
  ['Cypress', /\bcypress\b/i],
  ['OWASP', /\bowasp\b/i],
]

function optionValue(name, value, fallback) {
  const options = filterOptions[name]
  const selected = value || fallback
  if (!Object.hasOwn(options, selected)) throw new RangeError(`Filtro ${name} no válido.`)
  return selected
}

export function normalizeJobFilters(filters = {}) {
  return {
    region: optionValue('region', filters.region, defaultJobFilters.region),
    country: optionValue('country', filters.country, defaultJobFilters.country),
    workMode: optionValue('workMode', filters.workMode, defaultJobFilters.workMode),
  }
}

export function parseJobFilters(searchParams) {
  return normalizeJobFilters({
    region: searchParams.get('region'),
    country: searchParams.get('country'),
    workMode: searchParams.get('workMode'),
  })
}

function matchesLocation(job, filters) {
  if (filters.region === 'latam' && (job.region || 'unknown') !== 'latam') return false
  if (filters.country !== 'all') {
    if (filters.country === 'unknown') {
      if ((job.region || 'unknown') !== 'unknown') return false
    } else if (job.country !== filters.country) {
      return false
    }
  }
  if (filters.workMode !== 'all' && (job.workMode || 'unknown') !== filters.workMode)
    return false
  return true
}

export function analyzeJobs(role, jobs = demoJobs, filters = defaultJobFilters) {
  if (!Object.hasOwn(roles, role)) throw new RangeError('Invalid role')
  const selectedFilters = normalizeJobFilters(filters)
  const unique = [...new Map(jobs.map((job) => [job.id, job])).values()]
  const selected = unique
    .filter((job) => job.role === role)
    .filter((job) => matchesLocation(job, selectedFilters))
    .map((job) => {
      const searchable = [job.title, job.description, job.searchText].filter(Boolean).join(' ')
      const { searchText: _searchText, ...publicJob } = job
      return {
        ...publicJob,
        skills: rules.filter(([, pattern]) => pattern.test(searchable)).map(([name]) => name),
      }
    })
  const skills = rules
    .map(([name]) => {
      const count = selected.filter((job) => job.skills.includes(name)).length
      return {
        name,
        count,
        percent: selected.length ? Math.round((count / selected.length) * 100) : 0,
      }
    })
    .filter((skill) => skill.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    role,
    label: roles[role],
    filters: selectedFilters,
    total: selected.length,
    skills,
    jobs: selected,
  }
}

export function demoAnalysis(role, filters = defaultJobFilters) {
  return {
    ...analyzeJobs(role, demoJobs, filters),
    mode: 'demo',
    collectedAt: null,
    source: 'Ofertas ficticias de demostración',
  }
}

export function matchesRole(role, title) {
  if (!Object.hasOwn(roleMatchers, role)) throw new RangeError('Invalid role')
  return entryLevel.test(title) && roleMatchers[role].test(title)
}
