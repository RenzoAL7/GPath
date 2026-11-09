// Shared by the API and the browser, so a CV can be read without leaving the tab.
export const skillCatalog = [
  ['SQL', /\bsql\b/i, ['sql']],
  ['Excel', /\b(?:excel|spreadsheets?)\b/i, ['excel', 'spreadsheet', 'spreadsheets']],
  ['Power BI', /\bpower\s*bi\b/i, ['power bi', 'powerbi']],
  ['Tableau', /\btableau\b/i, ['tableau']],
  ['Python', /\b(?:python|phyton)\b/i, ['python', 'phyton']],
  ['R', /\b(?:r language|r programming)\b/i, ['r', 'r language', 'r programming']],
  ['Pandas', /\bpandas\b/i, ['pandas']],
  ['Scikit-learn', /\b(?:scikit[- ]?learn|sklearn)\b/i, ['scikit learn', 'scikitlearn', 'sklearn']],
  ['TensorFlow', /\btensorflow\b/i, ['tensorflow']],
  ['PyTorch', /\bpytorch\b/i, ['pytorch']],
  [
    'Machine Learning',
    /\b(?:machine learning|aprendizaje autom[aá]tico)\b/i,
    ['machine learning', 'aprendizaje automatico'],
  ],
  ['JavaScript', /\bjavascript\b/i, ['javascript']],
  ['TypeScript', /\btypescript\b/i, ['typescript']],
  ['Node.js', /\bnode(?:\.js|js)?\b/i, ['node', 'nodejs', 'node js', 'node.js']],
  ['Java', /\bjava\b/i, ['java']],
  ['React', /\breact(?:\.js)?\b/i, ['react', 'reactjs', 'react.js']],
  ['PostgreSQL', /\bpostgres(?:ql)?\b/i, ['postgres', 'postgresql']],
  ['MySQL', /\bmysql\b/i, ['mysql']],
  ['MongoDB', /\bmongo(?:db)?\b/i, ['mongo', 'mongodb']],
  ['Git', /\bgit\b/i, ['git']],
  ['Docker', /\bdocker\b/i, ['docker']],
  ['Kubernetes', /\b(?:kubernetes|k8s|k3s)\b/i, ['kubernetes', 'k8s', 'k3s']],
  ['Terraform', /\bterraform\b/i, ['terraform']],
  ['Linux', /\blinux\b/i, ['linux']],
  ['AWS', /\b(?:aws|amazon web services)\b/i, ['aws', 'amazon web services']],
  ['BigQuery', /\bbig\s*query\b/i, ['bigquery', 'big query']],
  ['GCP', /\b(?:gcp|google cloud)\b/i, ['gcp', 'google cloud']],
  ['Azure', /\bazure\b/i, ['azure']],
  ['Airflow', /\bairflow\b/i, ['airflow']],
  ['Spark', /\b(?:apache )?spark\b/i, ['spark', 'apache spark']],
  ['dbt', /\bdbt\b/i, ['dbt']],
  ['Kafka', /\bkafka\b/i, ['kafka']],
  [
    'CI/CD',
    /\b(?:ci\s*\/?\s*cd|continuous integration|continuous delivery)\b/i,
    ['ci cd', 'continuous integration', 'continuous delivery'],
  ],
]

const maxLineLength = 220

function textLines(value) {
  return value
    .split(/\r?\n|(?<=[.;•])\s+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Finds catalog skills in free text, with the first line that mentions each. */
export function detectSkills(value) {
  const lines = textLines(value)
  const found = []
  for (const [name, pattern] of skillCatalog) {
    const line = lines.find((candidate) => pattern.test(candidate))
    if (line) found.push({ name, line: line.slice(0, maxLineLength) })
  }
  return found
}

export function mentionsSkill(name, value) {
  const entry = skillCatalog.find(([candidate]) => candidate === name)
  return entry
    ? entry[1].test(value)
    : value.toLocaleLowerCase('es').includes(name.toLocaleLowerCase('es'))
}
