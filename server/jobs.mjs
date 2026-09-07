import { demoJobs } from './demo-jobs.mjs'
export const roles = { data: 'Data Engineer', backend: 'Backend', devops: 'DevOps' }
const rules = [
  ['Python', /\bpython\b/i],
  ['SQL', /\bsql\b/i],
  ['PostgreSQL', /\bpostgres(?:ql)?\b/i],
  ['AWS', /\baws\b/i],
  ['Docker', /\bdocker\b/i],
  ['Kubernetes', /\b(?:kubernetes|k8s|k3s)\b/i],
  ['Terraform', /\bterraform\b/i],
  ['Git', /\bgit\b/i],
  ['CI/CD', /\bci\s*\/\s*cd\b/i],
  ['Linux', /\blinux\b/i],
  ['Go', /\b(?:go|golang)\b/i],
  ['TypeScript', /\btypescript\b/i],
]
export function analyzeJobs(role, jobs = demoJobs) {
  if (!Object.hasOwn(roles, role)) throw new RangeError('Invalid role')
  const unique = [...new Map(jobs.map((job) => [job.id, job])).values()]
  const selected = unique
    .filter((job) => job.role === role)
    .map((job) => ({
      ...job,
      skills: rules.filter(([, pattern]) => pattern.test(job.description)).map(([name]) => name),
    }))
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
