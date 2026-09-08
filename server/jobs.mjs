import { demoJobs } from './demo-jobs.mjs'

export const roles = {
  'frontend-intern': 'Frontend Intern',
  'backend-intern': 'Backend Intern',
  'data-intern': 'Data Intern',
  'devops-intern': 'DevOps Intern',
  'qa-intern': 'QA Automation Intern',
  'security-intern': 'Cybersecurity Intern',
  'data-engineer-intern': 'Data Engineer Intern',
  'data-engineering-intern': 'Data Engineering Intern',
  'data-infrastructure-intern': 'Data Infrastructure Intern',
  'data-platform-intern': 'Data Platform Intern',
  'cloud-engineer-intern': 'Cloud Engineer Intern',
  'cloud-infrastructure-intern': 'Cloud Infrastructure Intern',
  'platform-engineer-intern': 'Platform Engineer Intern',
  'infrastructure-engineer-intern': 'Infrastructure Engineer Intern',
  'mlops-intern': 'MLOps Intern',
  'machine-learning-engineer-intern': 'Machine Learning Engineer Intern',
  'ml-engineer-intern': 'ML Engineer Intern',
  'ai-engineer-intern': 'AI Engineer Intern',
  'software-engineer-intern-data': 'Software Engineer Intern Data',
  'software-engineer-intern-infrastructure': 'Software Engineer Intern Infrastructure',
  'software-engineer-intern-backend': 'Software Engineer Intern Backend',
  'sre-intern': 'SRE Intern',
  'site-reliability-engineer-intern': 'Site Reliability Engineer Intern',
  'big-data-intern': 'Big Data Intern',
  'analytics-engineer-intern': 'Analytics Engineer Intern',
  'dataops-intern': 'DataOps Intern',
}

const entryLevel = /\b(?:intern(?:ship)?|practicante)\b/i
export const roleMatchers = {
  'frontend-intern': /\b(?:frontend|front-end|web|ui)\b/i,
  'backend-intern': /\b(?:backend|back-end|server[- ]side|api)\b/i,
  'data-intern': /\b(?:data|analytics|etl|machine learning)\b/i,
  'devops-intern': /\b(?:devops|dev ops|platform|site reliability|\bsre\b|cloud|infrastructure)\b/i,
  'qa-intern': /\b(?:qa|quality assurance|test(?:ing)?|automation)\b/i,
  'security-intern': /\b(?:cybersecurity|cyber security|security|appsec|application security)\b/i,
  'data-engineer-intern': /\bdata engineer\b/i,
  'data-engineering-intern': /\bdata engineering\b/i,
  'data-infrastructure-intern': /\bdata infrastructure\b/i,
  'data-platform-intern': /\bdata platform\b/i,
  'cloud-engineer-intern': /\bcloud engineer\b/i,
  'cloud-infrastructure-intern': /\bcloud infrastructure\b/i,
  'platform-engineer-intern': /\bplatform engineer\b/i,
  'infrastructure-engineer-intern': /\binfrastructure engineer\b/i,
  'mlops-intern': /\bmlops\b|\bmachine learning operations\b/i,
  'machine-learning-engineer-intern': /\bmachine learning engineer\b/i,
  'ml-engineer-intern': /\bml engineer\b/i,
  'ai-engineer-intern': /\bai engineer\b/i,
  'software-engineer-intern-data': /\bsoftware engineer\b.*\bdata\b/i,
  'software-engineer-intern-infrastructure': /\bsoftware engineer\b.*\binfrastructure\b/i,
  'software-engineer-intern-backend': /\bsoftware engineer\b.*\bbackend\b/i,
  'sre-intern': /\bsre\b/i,
  'site-reliability-engineer-intern': /\bsite reliability engineer\b/i,
  'big-data-intern': /\bbig data\b/i,
  'analytics-engineer-intern': /\banalytics engineer\b/i,
  'dataops-intern': /\bdata[ -]?ops\b/i,
}

export const roleFamilies = {
  'frontend-intern': 'frontend-intern',
  'backend-intern': 'backend-intern',
  'data-intern': 'data-intern',
  'devops-intern': 'devops-intern',
  'qa-intern': 'qa-intern',
  'security-intern': 'security-intern',
  'data-engineer-intern': 'data-intern',
  'data-engineering-intern': 'data-intern',
  'data-infrastructure-intern': 'data-intern',
  'data-platform-intern': 'data-intern',
  'cloud-engineer-intern': 'devops-intern',
  'cloud-infrastructure-intern': 'devops-intern',
  'platform-engineer-intern': 'devops-intern',
  'infrastructure-engineer-intern': 'devops-intern',
  'mlops-intern': 'data-intern',
  'machine-learning-engineer-intern': 'data-intern',
  'ml-engineer-intern': 'data-intern',
  'ai-engineer-intern': 'data-intern',
  'software-engineer-intern-data': 'data-intern',
  'software-engineer-intern-infrastructure': 'devops-intern',
  'software-engineer-intern-backend': 'backend-intern',
  'sre-intern': 'devops-intern',
  'site-reliability-engineer-intern': 'devops-intern',
  'big-data-intern': 'data-intern',
  'analytics-engineer-intern': 'data-intern',
  'dataops-intern': 'data-intern',
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
  if (filters.workMode !== 'all' && (job.workMode || 'unknown') !== filters.workMode) return false
  return true
}

export function analyzeJobs(role, jobs = demoJobs, filters = defaultJobFilters) {
  if (!Object.hasOwn(roles, role)) throw new RangeError('Invalid role')
  const selectedFilters = normalizeJobFilters(filters)
  const family = roleFamilies[role]
  const unique = [...new Map(jobs.map((job) => [job.id, job])).values()]
  const selected = unique
    .filter((job) => job.role === role || job.role === family)
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
