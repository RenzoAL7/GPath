import { OfferReadError, readPublicOffer, validatePublicOfferUrl } from './public-offer.mjs'

const maxDescriptionLength = 40_000
const maxSkills = 24
const maxSkillLength = 60
const maxEvidenceLength = 320
const maxOfferTitleLength = 120

const roleProfiles = Object.freeze({
  'data-analyst': {
    label: 'Data Analyst',
    anchors: ['SQL', 'Excel', 'Power BI', 'Tableau', 'Python'],
  },
  'data-engineer': {
    label: 'Data Engineer',
    anchors: ['Python', 'SQL', 'Airflow', 'Spark', 'Docker'],
  },
  'backend-developer': {
    label: 'Backend Developer',
    anchors: ['Node.js', 'Python', 'Java', 'SQL', 'Git'],
  },
  'cloud-devops': {
    label: 'Cloud / DevOps',
    anchors: ['Docker', 'Kubernetes', 'Terraform', 'Linux', 'AWS'],
  },
  'machine-learning': {
    label: 'IA / Machine Learning',
    anchors: ['Python', 'Machine Learning', 'Pandas', 'Scikit-learn', 'SQL'],
  },
  other: { label: 'Otro', anchors: [] },
})

export const targetRoles = Object.freeze(
  Object.fromEntries(Object.entries(roleProfiles).map(([id, value]) => [id, value.label])),
)

const profileLevels = new Set(['practicante', 'internship', 'junior'])
const locationPreferences = new Set(['pe', 'latam', 'any'])
const levelRanks = { practicante: 1, internship: 1, junior: 2 }

const skillCatalog = [
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

const latinAmerica = [
  'perú',
  'peru',
  'méxico',
  'mexico',
  'colombia',
  'chile',
  'argentina',
  'ecuador',
  'bolivia',
  'brasil',
  'brazil',
  'latam',
  'latin america',
  'américa latina',
  'america latina',
]

export class AnalysisInputError extends Error {
  constructor(message, { status = 400, code = 'invalid_analysis_input' } = {}) {
    super(message)
    this.name = 'AnalysisInputError'
    this.status = status
    this.code = code
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeIdentity(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function entryForSkill(value) {
  const identity = normalizeIdentity(value)
  return skillCatalog.find(([, , aliases]) => aliases.includes(identity))
}

function skillName(value) {
  return entryForSkill(value)?.[0] || text(value)
}

function uniqueSkills(values) {
  const result = []
  const seen = new Set()
  for (const value of values) {
    const candidate = skillName(value)
    if (!candidate || candidate.length > maxSkillLength) continue
    const identity = normalizeIdentity(candidate)
    if (!identity || seen.has(identity)) continue
    seen.add(identity)
    result.push(candidate)
  }
  return result
}

function parsedSkills(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  if (!values.every((item) => typeof item === 'string'))
    throw new AnalysisInputError('Las habilidades deben ser texto corto.')
  if (values.length > maxSkills)
    throw new AnalysisInputError(`Indica hasta ${maxSkills} habilidades para este análisis.`)
  return uniqueSkills(values)
}

function parsedProfile(value) {
  if (!isRecord(value)) throw new AnalysisInputError('Completa el nivel de tu perfil.')
  const level = text(value.level).toLocaleLowerCase('es')
  const preferenceSource = text(value.preference || value.locationPreference).toLocaleLowerCase(
    'es',
  )
  const preference = preferenceSource
    ? preferenceSource === 'peru' || preferenceSource === 'perú'
      ? 'pe'
      : preferenceSource
    : null
  if (!profileLevels.has(level)) throw new AnalysisInputError('Selecciona un nivel válido.')
  if (preference !== null && !locationPreferences.has(preference))
    throw new AnalysisInputError('La preferencia de ubicación no es válida.')
  const skills = parsedSkills(value.skills)
  return preference === null ? { level, skills } : { level, skills, preference }
}

/** Validates input before any offer URL is requested. */
export function parseAnalysisRequest(value) {
  if (!isRecord(value)) throw new AnalysisInputError('El análisis debe enviarse como datos JSON.')
  const targetRole = text(value.targetRole)
  if (!Object.hasOwn(roleProfiles, targetRole))
    throw new AnalysisInputError('Selecciona uno de los puestos disponibles.')
  const url = text(value.url)
  const description = text(value.description || value.text)
  if (Boolean(url) === Boolean(description))
    throw new AnalysisInputError(
      'Pega un enlace público o la descripción de la oferta, pero no ambos.',
    )
  if (url.length > 2048) throw new AnalysisInputError('El enlace es demasiado largo.')
  if (description.length > maxDescriptionLength)
    throw new AnalysisInputError('La descripción supera el tamaño permitido.', {
      status: 413,
      code: 'description_too_large',
    })
  if (description && description.length < 40)
    throw new AnalysisInputError('Pega una descripción más completa para poder analizarla.')
  const parsed = { targetRole, profile: parsedProfile(value.profile) }
  if (url) {
    try {
      return { ...parsed, url: validatePublicOfferUrl(url).toString() }
    } catch (error) {
      if (error instanceof OfferReadError) throw new AnalysisInputError(error.message)
      throw error
    }
  }
  return { ...parsed, description }
}

function decodeHtml(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
  }
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi,
    (match, decimal, hexadecimal, name) => {
      if (decimal) return String.fromCodePoint(Number(decimal))
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16))
      return named[name.toLocaleLowerCase('en')] || match
    },
  )
}

function metadataOfferText(value) {
  const fragments = []
  for (const match of value.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...match[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/gi)].map(([, name, , content]) => [
        name.toLocaleLowerCase('en'),
        content,
      ]),
    )
    const name = (attributes.name || attributes.property || '').toLocaleLowerCase('en')
    if ((name === 'description' || name === 'og:description') && attributes.content)
      fragments.push(attributes.content)
  }
  return fragments.join('\n')
}

function compactOfferTitle(value) {
  const title = decodeHtml(String(value || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title || title.length > maxOfferTitleLength) return null
  return title
}

function metadataOfferTitle(value) {
  if (typeof value !== 'string') return null
  const metadata = []
  for (const match of value.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...match[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/gi)].map(([, name, , content]) => [
        name.toLocaleLowerCase('en'),
        content,
      ]),
    )
    const name = (attributes.name || attributes.property || '').toLocaleLowerCase('en')
    if ((name === 'og:title' || name === 'twitter:title') && attributes.content)
      metadata.push(attributes.content)
  }
  const heading = value.match(/<h1\b[^>]*>([\s\S]*?)<\s*\/\s*h1\s*>/i)?.[1]
  const pageTitle = value.match(/<title\b[^>]*>([\s\S]*?)<\s*\/\s*title\s*>/i)?.[1]
  return [heading, ...metadata, pageTitle].map(compactOfferTitle).find(Boolean) || null
}

function titleFromText(value) {
  const rolePattern =
    /\b(?:data\s+(?:analyst|engineer|scientist)|analista(?:\s+de)?\s+datos|ingenier[oa](?:\s+de)?\s+datos|backend(?:\s+(?:developer|engineer))?|desarrollador(?:a)?\s+(?:de\s+)?backend|cloud\s*(?:\/|&|and)?\s*devops|(?:machine learning|ml|ia)(?:\s+(?:engineer|intern|practicante))?|practicante(?:\s+de)?\s+[\p{L}\d/& -]{2,48})(?:\s+(?:junior|internship|intern|practicante))?\b/iu
  const roleMatch = compactOfferTitle(value.match(rolePattern)?.[0])
  if (roleMatch) return roleMatch

  const lines = value
    .split(/\n+/)
    .map((line) => compactOfferTitle(line))
    .filter(Boolean)
  const standalone = lines.find(
    (line) =>
      line.length <= 90 &&
      !/[.!?]$/.test(line) &&
      !/^(?:buscamos|estamos buscando|se busca|conoce|acerca de|sobre el puesto)\b/i.test(line),
  )
  if (standalone) return standalone
  return null
}

/** Returns a visible title only when it appears in the source offer text. */
export function extractOfferTitle(sourceText, cleanedText = cleanOfferText(sourceText)) {
  return metadataOfferTitle(sourceText) || titleFromText(cleanedText)
}

/** Removes markup and scripts without executing any content from the offer. */
export function cleanOfferText(value) {
  if (typeof value !== 'string') return ''
  const metadata = metadataOfferText(value)
  const visibleText = value
    .replace(
      /<\s*(?:script|style|noscript|svg|canvas|iframe)[\s\S]*?<\s*\/\s*(?:script|style|noscript|svg|canvas|iframe)\s*>/gi,
      ' ',
    )
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|div|li|h[1-6]|section|article|tr)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
  return decodeHtml([visibleText, metadata].filter(Boolean).join('\n'))
    .replace(/\r/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, maxDescriptionLength)
}

function sentences(textValue) {
  const value = textValue.replace(/\n+/g, '. ')
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function shorten(value, limit = maxEvidenceLength) {
  const normalized = text(value)
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1).trimEnd()}…`
}

function firstEvidence(lines, pattern) {
  return lines.find((line) => pattern.test(line)) || null
}

function levelFromText(value) {
  if (/\b(?:internship|intern|practicante)\b/i.test(value)) return 'Practicante / Internship'
  if (/\bjunior\b/i.test(value)) return 'Junior'
  return null
}

function levelRank(value) {
  if (!value) return null
  if (/junior/i.test(value)) return levelRanks.junior
  if (/(?:practicante|internship|intern)/i.test(value)) return levelRanks.practicante
  return null
}

function locationFromText(value) {
  const normalized = normalizeIdentity(value)
  if (/\b(?:peru|lima)\b/.test(normalized)) return 'Perú'
  if (/\b(?:latam|latin america|america latina)\b/.test(normalized)) return 'Remoto LATAM'
  const country = latinAmerica.find((name) => {
    const candidate = normalizeIdentity(name).replace(/ /g, '\\s+')
    return new RegExp(`\\b${candidate}\\b`).test(normalized)
  })
  return country ? country.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : null
}

function workModeFromText(value) {
  if (/\b(?:remoto|remote|work from home|teletrabajo)\b/i.test(value)) return 'Remoto'
  if (/\b(?:híbrido|hibrido|hybrid)\b/i.test(value)) return 'Híbrido'
  if (/\b(?:presencial|on[- ]?site|in office)\b/i.test(value)) return 'Presencial'
  return null
}

function salaryFromText(value) {
  const match = value.match(
    /(?:s\/\.?\s?|usd\s?|us\$\s?|\$\s?)(?:\d{1,3}(?:[,.]\d{3})+|\d+)(?:\s*(?:-|a|to)\s*(?:s\/\.?\s?|usd\s?|us\$\s?|\$\s?)?(?:\d{1,3}(?:[,.]\d{3})+|\d+))?/i,
  )
  return match ? match[0].trim() : null
}

function roleEvidence(lines, targetRole) {
  const label = roleProfiles[targetRole].label
  return firstEvidence(lines, new RegExp(label.replace(/\s*\/\s*/g, '|'), 'i'))
}

/**
 * Rules establish the evidence boundary. An optional LLM may classify these
 * facts, but it cannot add a fact whose text is absent from the offer.
 */
export function extractOfferFacts(cleanedText, targetRole = 'other') {
  const lines = sentences(cleanedText)
  const technical = []
  const preferred = []
  const evidence = []
  for (const [name, pattern] of skillCatalog) {
    const line = firstEvidence(lines, pattern)
    if (!line) continue
    const isPreferred =
      /\b(?:deseable|preferido|preferible|plus|nice to have|valorable|ideal)\b/i.test(line)
    ;(isPreferred ? preferred : technical).push(name)
    evidence.push({ label: isPreferred ? 'Deseable' : 'Requisito técnico', text: shorten(line) })
  }
  const levelEvidence = firstEvidence(lines, /\b(?:internship|intern|practicante|junior)\b/i)
  const locationEvidence = firstEvidence(
    lines,
    /\b(?:perú|peru|lima|latam|latin america|américa latina|america latina|remoto|remote|híbrido|hibrido|hybrid|presencial|on[- ]?site)\b/i,
  )
  const salaryEvidence = firstEvidence(
    lines,
    /(?:s\/\.?\s?|usd\s?|us\$\s?|\$\s?)(?:\d{1,3}(?:[,.]\d{3})+|\d+)/i,
  )
  const level = levelEvidence ? levelFromText(levelEvidence) : null
  const location = locationEvidence ? locationFromText(locationEvidence) : null
  const workMode = locationEvidence ? workModeFromText(locationEvidence) : null
  const salary = salaryEvidence ? salaryFromText(salaryEvidence) : null
  if (levelEvidence && level)
    evidence.push({ label: 'Nivel detectado', text: shorten(levelEvidence) })
  if (locationEvidence && (location || workMode))
    evidence.push({ label: 'Ubicación y modalidad', text: shorten(locationEvidence) })
  if (salaryEvidence && salary) evidence.push({ label: 'Salario', text: shorten(salaryEvidence) })
  const titleEvidence = roleEvidence(lines, targetRole)
  if (titleEvidence) evidence.push({ label: 'Puesto relacionado', text: shorten(titleEvidence) })
  return {
    technical: uniqueSkills(technical),
    preferred: uniqueSkills(preferred),
    level,
    location,
    workMode,
    salary,
    evidence: uniqueEvidence(evidence),
  }
}

function uniqueEvidence(value) {
  const seen = new Set()
  return value.filter((item) => {
    const key = `${item.label}:${normalizeIdentity(item.text)}`
    if (!item.text || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function evidenceExists(value, source) {
  const needle = normalizeIdentity(value)
  return needle.length >= 3 && normalizeIdentity(source).includes(needle)
}

function validModelSkill(value, source) {
  const entry = entryForSkill(value)
  if (!entry || !entry[1].test(source)) return null
  return entry[0]
}

function mergeValidatedModelFacts(base, candidate, source) {
  if (!isRecord(candidate)) return base
  const technical = uniqueSkills([
    ...base.technical,
    ...(Array.isArray(candidate.technical)
      ? candidate.technical.map((item) => validModelSkill(item, source))
      : []),
  ])
  const preferred = uniqueSkills([
    ...base.preferred,
    ...(Array.isArray(candidate.preferred)
      ? candidate.preferred.map((item) => validModelSkill(item, source))
      : []),
  ]).filter((item) => !technical.includes(item))
  const modelEvidence = Array.isArray(candidate.evidence)
    ? candidate.evidence
        .filter(
          (item) =>
            isRecord(item) && typeof item.label === 'string' && typeof item.text === 'string',
        )
        .filter((item) => evidenceExists(item.text, source))
        .map((item) => ({ label: shorten(item.label, 70), text: shorten(item.text) }))
    : []
  return {
    technical,
    preferred,
    level: base.level,
    location: base.location,
    workMode: base.workMode,
    salary: base.salary,
    evidence: uniqueEvidence([...base.evidence, ...modelEvidence]),
  }
}

function scoreFromSimilarity(value) {
  const numeric = typeof value === 'number' ? value : value?.score
  if (!Number.isFinite(numeric)) return null
  return Math.round(Math.max(0, Math.min(1, numeric <= 1 ? numeric : numeric / 100)) * 100)
}

function overlapScore(reference, requirements) {
  const target = uniqueSkills(requirements).map(normalizeIdentity)
  if (!target.length) return null
  const available = new Set(uniqueSkills(reference).map(normalizeIdentity))
  return Math.round((target.filter((item) => available.has(item)).length / target.length) * 100)
}

function fallbackSimilarity({ targetRole, requirements, profile }) {
  const role = roleProfiles[targetRole] || roleProfiles.other
  const reference = profile.skills.length ? profile.skills : role.anchors
  const required = [...requirements.technical, ...requirements.preferred]
  const overlap = overlapScore(reference, required)
  if (overlap === null) return 0.5
  // The fallback is deliberately conservative. It is clearly labelled in the result.
  return 0.25 + overlap / 200
}

function locationScore(requirements, preference) {
  const location = normalizeIdentity(requirements.location || '')
  const mode = normalizeIdentity(requirements.workMode || '')
  if (!preference || (!location && !mode)) return null
  if (preference === 'any') return 100
  const isPeru = /\b(?:peru|lima)\b/.test(location)
  const isLatam =
    /\b(?:latam|latin america|america latina|peru|mexico|colombia|chile|argentina|ecuador|bolivia|brasil|brazil)\b/.test(
      location,
    )
  const isRemote = /\bremot/.test(mode)
  if (preference === 'pe') {
    if (isPeru) return 100
    if (isRemote && isLatam) return 75
    return 0
  }
  if (preference === 'latam') {
    if (isLatam) return 100
    if (isRemote && !location) return 65
    return 0
  }
  return null
}

function factor(id, label, score, weight, detail) {
  return { id, label, score, weight, contribution: 0, available: score !== null, detail }
}

/**
 * Calculates the score independently of extraction or explanation models.
 * Base weights are visible and unavailable evidence is excluded then
 * proportionally reweighted, never guessed.
 */
export function calculateCompatibility({
  requirements,
  profile,
  semanticSimilarity,
  targetRole = 'other',
}) {
  const selectedProfile = parsedProfile(profile)
  const technical = uniqueSkills(requirements?.technical || [])
  const profileProvided = selectedProfile.skills.length > 0
  const referenceSkills = profileProvided ? selectedProfile.skills : []
  const technicalScore = profileProvided ? overlapScore(referenceSkills, technical) : null
  const matched = profileProvided
    ? selectedProfile.skills.filter((skill) =>
        technical.some((item) => normalizeIdentity(item) === normalizeIdentity(skill)),
      )
    : []
  const gaps = profileProvided
    ? technical.filter(
        (skill) => !matched.some((item) => normalizeIdentity(item) === normalizeIdentity(skill)),
      )
    : []
  const detectedLevelRank = levelRank(requirements?.level)
  const experienceScore =
    detectedLevelRank === null
      ? null
      : levelRanks[selectedProfile.level] >= detectedLevelRank
        ? 100
        : 0
  const semanticScore = scoreFromSimilarity(semanticSimilarity)
  const geographicScore = locationScore(requirements || {}, selectedProfile.preference)
  const geographicDetail = !selectedProfile.preference
    ? 'La ubicación y modalidad se muestran como datos de la oferta; no se usan como preferencia personal.'
    : geographicScore === null
      ? 'La oferta no indica una ubicación o modalidad verificable.'
      : 'Se contrasta con tu preferencia de Perú, remoto LATAM o cualquiera.'
  const factors = [
    factor(
      'technical-skills',
      'Habilidades técnicas coincidentes',
      technicalScore,
      50,
      technicalScore === null
        ? 'No se detectaron tecnologías técnicas suficientes en la oferta.'
        : profileProvided
          ? `${matched.length} de ${technical.length} habilidades técnicas detectadas coinciden con tu perfil.`
          : 'Se compara la oferta con el puesto objetivo porque aún no indicaste habilidades.',
    ),
    factor(
      'semantic-similarity',
      'Similitud semántica',
      semanticScore,
      25,
      'Compara el lenguaje de la oferta con el perfil o puesto objetivo.',
    ),
    factor(
      'experience-level',
      'Nivel de experiencia',
      experienceScore,
      15,
      experienceScore === null
        ? 'La oferta no indica un nivel de experiencia verificable.'
        : 'Se contrasta el nivel indicado en tu perfil con el nivel detectado.',
    ),
    factor('location-work-mode', 'Ubicación y modalidad', geographicScore, 10, geographicDetail),
  ]
  const totalWeight = factors
    .filter((item) => item.available)
    .reduce((total, item) => total + item.weight, 0)
  const available = factors.filter((item) => item.available)
  for (const item of available) {
    item.effectiveWeight = (item.weight / totalWeight) * 100
    item.contribution = Number(((item.score / 100) * (item.weight / totalWeight) * 100).toFixed(2))
  }
  const weighted =
    totalWeight === 0
      ? 0
      : Math.round(
          factors.reduce(
            (total, item) =>
              total + (item.available ? item.score * (item.weight / totalWeight) : 0),
            0,
          ),
        )
  const score = Math.max(0, Math.min(100, weighted))
  const label =
    score >= 75
      ? 'Alta compatibilidad'
      : score >= 45
        ? 'Compatibilidad parcial'
        : 'Baja compatibilidad'
  const recommendation =
    score >= 75 ? 'Vale la pena postular' : score >= 45 ? 'Revisar brechas' : 'No es prioritaria'
  return {
    compatibility: { score, label, recommendation, scope: profileProvided ? 'profile' : 'target' },
    factors,
    profile: {
      provided: profileProvided,
      matched: uniqueSkills(matched),
      gaps: uniqueSkills(gaps),
    },
  }
}

function fallbackExplanation({ compatibility, profile, requirements, targetRole = 'other' }) {
  const general = targetRole === 'other' && !profile.provided
  const intro = general
    ? 'La lectura general se basa en el texto visible de la oferta.'
    : compatibility.scope === 'profile'
      ? `La compatibilidad orientativa es ${compatibility.score}/100.`
      : `La compatibilidad orientativa es ${compatibility.score}/100 con el puesto objetivo.`
  const skills = requirements.technical.length
    ? `La oferta menciona ${requirements.technical.slice(0, 5).join(', ')}.`
    : 'No se detectaron tecnologías técnicas suficientes en el texto disponible.'
  const next = general
    ? 'Revisa las evidencias y condiciones detectadas antes de postular.'
    : compatibility.scope === 'profile'
      ? profile.gaps.length
        ? `Antes de postular, revisa estas brechas: ${profile.gaps.slice(0, 4).join(', ')}.`
        : 'No se detectaron brechas técnicas directas con las habilidades que indicaste.'
      : 'Agrega tus habilidades para convertir esta lectura en una compatibilidad personal.'
  return `${intro} ${skills} ${next}`
}

function validExplanation(value, allowedSkills) {
  const candidate = typeof value === 'string' ? value : value?.explanation || value?.text
  if (typeof candidate !== 'string') return null
  const output = shorten(candidate, 700)
  if (output.length < 20) return null
  const allowed = new Set(allowedSkills.map(normalizeIdentity))
  const hasUnsupportedSkill = skillCatalog.some(
    ([name, pattern]) => !allowed.has(normalizeIdentity(name)) && pattern.test(output),
  )
  return hasUnsupportedSkill ? null : output
}

function analysisLimitations({ input, profileProvided, modelUse, facts, targetRole = 'other' }) {
  const general = targetRole === 'other' && !profileProvided
  const values = [
    general
      ? 'El análisis es orientativo: no garantiza una entrevista, una oferta ni que la vacante siga activa.'
      : 'El puntaje es orientativo: no garantiza una entrevista, una oferta ni que la vacante siga activa.',
    'Solo se evalúa el texto que se pudo leer; requisitos implícitos o contenido que exige iniciar sesión pueden no aparecer.',
  ]
  if (general)
    values.push('El análisis se basa únicamente en el texto público disponible de la oferta.')
  else if (!profileProvided)
    values.push(
      'No indicaste habilidades actuales, por eso no se presenta como compatibilidad personal.',
    )
  if (input.type === 'url')
    values.push('El enlace se leyó sin iniciar sesión ni ejecutar scripts de la página.')
  if (!facts.salary) values.push('No se detectó un salario verificable en el texto disponible.')
  if (!modelUse.extractor || !modelUse.semantic || !modelUse.explainer)
    values.push(
      general
        ? 'El servicio local de modelos no estuvo disponible en todas las etapas; se muestran solo datos verificables.'
        : 'El servicio local de modelos no estuvo disponible en todas las etapas; se muestran solo datos verificables y el puntaje determinista.',
    )
  if (!modelUse.semantic)
    values.push(
      general
        ? 'La lectura semántica usa una estimación de respaldo; JobBERT no se ejecutó.'
        : 'La similitud semántica usa una estimación de respaldo; JobBERT no se ejecutó.',
    )
  return values
}

/**
 * Creates the user-facing workflow. Adapters are optional and intentionally
 * receive only cleaned offer text plus structured data. The final score never
 * comes from an LLM response.
 */
export function createOfferAnalyzer({
  readOffer = readPublicOffer,
  extractRequirements,
  semanticSimilarity,
  explain,
} = {}) {
  return {
    async analyze(request) {
      const parsed = parseAnalysisRequest(request)
      const source = parsed.url
        ? await readOffer(parsed.url)
        : { text: parsed.description, originalUrl: null }
      const cleaned = cleanOfferText(source?.text)
      if (cleaned.length < 40)
        throw new AnalysisInputError(
          'No pudimos encontrar suficiente texto en la oferta. Pega la descripción manualmente.',
          {
            status: 422,
            code: 'insufficient_offer_text',
          },
        )
      const input = parsed.url
        ? { type: 'url', originalUrl: source?.originalUrl || parsed.url }
        : { type: 'text' }
      let requirements = extractOfferFacts(cleaned, parsed.targetRole)
      const modelUse = { extractor: false, semantic: false, explainer: false }
      if (typeof extractRequirements === 'function') {
        try {
          requirements = mergeValidatedModelFacts(
            requirements,
            await extractRequirements({ text: cleaned, targetRole: parsed.targetRole }),
            cleaned,
          )
          modelUse.extractor = true
        } catch {
          // The deterministic evidence boundary remains useful when a local model is unavailable.
        }
      }
      let semantic = fallbackSimilarity({
        targetRole: parsed.targetRole,
        requirements,
        profile: parsed.profile,
      })
      if (typeof semanticSimilarity === 'function') {
        try {
          const candidate = await semanticSimilarity({
            text: cleaned,
            targetRole: parsed.targetRole,
            requirements,
            profile: parsed.profile,
          })
          if (scoreFromSimilarity(candidate) !== null) {
            semantic = candidate
            modelUse.semantic = true
          }
        } catch {
          // The response makes the fallback visible through its limitations.
        }
      }
      const scored = calculateCompatibility({
        requirements,
        profile: parsed.profile,
        semanticSimilarity: semantic,
        targetRole: parsed.targetRole,
      })
      let explanation = fallbackExplanation({
        ...scored,
        requirements,
        targetRole: parsed.targetRole,
      })
      if (typeof explain === 'function') {
        try {
          const candidate = validExplanation(
            await explain({
              targetRole: targetRoles[parsed.targetRole],
              requirements,
              profile: scored.profile,
              compatibility: scored.compatibility,
              factors: scored.factors,
            }),
            [...requirements.technical, ...requirements.preferred, ...scored.profile.matched],
          )
          if (candidate) {
            explanation = candidate
            modelUse.explainer = true
          }
        } catch {
          // A template prevents a model outage from changing the deterministic result.
        }
      }
      return {
        input,
        offer: { title: extractOfferTitle(source?.text, cleaned) },
        targetRole: { id: parsed.targetRole, label: targetRoles[parsed.targetRole] },
        compatibility: scored.compatibility,
        factors: scored.factors,
        requirements: {
          technical: requirements.technical,
          preferred: requirements.preferred,
          level: requirements.level,
          location: requirements.location,
          workMode: requirements.workMode,
          salary: requirements.salary,
        },
        profile: scored.profile,
        evidence: requirements.evidence,
        explanation,
        limitations: analysisLimitations({
          input,
          profileProvided: scored.profile.provided,
          modelUse,
          facts: requirements,
          targetRole: parsed.targetRole,
        }),
      }
    },
  }
}

export { OfferReadError }
