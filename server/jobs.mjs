import { demoJobs } from './demo-jobs.mjs'
export const roles = { data: 'Data Engineer', backend: 'Backend', devops: 'DevOps' }
export const roleMatchers = {
  data: /\b(?:data engineer|analytics engineer|data platform|data infrastructure|data scientist|machine learning engineer|data engineering)\b/i,
  backend: /\b(?:backend|back-end|server-side|api engineer|software engineer)\b/i,
  devops:
    /\b(?:devops|dev ops|platform engineer|site reliability|\bsre\b|cloud engineer|infrastructure engineer|developer productivity)\b/i,
}
const rules = [
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
  ['Go', /\bgolang\b|\bgo (?:services|programming|development|language)\b/i],
  ['TypeScript', /\btypescript\b/i],
  ['JavaScript', /\bjavascript\b/i],
  ['Java', /\bjava\b/i],
  ['Node.js', /\bnode(?:\.js|js)\b/i],
  ['Redis', /\bredis\b/i],
  ['Kafka', /\bkafka\b/i],
  ['Spark', /\bspark\b/i],
  ['Airflow', /\bairflow\b/i],
  ['Snowflake', /\bsnowflake\b/i],
  ['React', /\breact(?:\.js)?\b/i],
]
export function analyzeJobs(role, jobs = demoJobs) {
  if (!Object.hasOwn(roles, role)) throw new RangeError('Invalid role')
  const unique = [...new Map(jobs.map((job) => [job.id, job])).values()]
  const selected = unique
    .filter((job) => job.role === role)
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
  return { role, label: roles[role], total: selected.length, skills, jobs: selected }
}
export function demoAnalysis(role) {
  return {
    ...analyzeJobs(role),
    mode: 'demo',
    collectedAt: null,
    source: 'Ofertas ficticias de demostración',
  }
}

export function matchesRole(role, title) {
  if (!Object.hasOwn(roleMatchers, role)) throw new RangeError('Invalid role')
  return roleMatchers[role].test(title)
}
