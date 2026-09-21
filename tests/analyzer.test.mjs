import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateCompatibility,
  cleanOfferText,
  createOfferAnalyzer,
  extractOfferFacts,
  extractOfferTitle,
  targetRoles,
} from '../server/analyzer.mjs'

const roleIds = [
  'data-analyst',
  'data-engineer',
  'backend-developer',
  'cloud-devops',
  'machine-learning',
  'other',
]

const frontendKeys = [
  'compatibility',
  'evidence',
  'explanation',
  'factors',
  'input',
  'limitations',
  'offer',
  'profile',
  'requirements',
  'targetRole',
]

function offerRequirements(overrides = {}) {
  return {
    technical: ['Python', 'SQL', 'Airflow', 'Docker'],
    preferred: [],
    level: 'junior',
    location: 'Lima, Perú',
    workMode: 'onsite',
    salary: null,
    ...overrides,
  }
}

function userProfile(overrides = {}) {
  return {
    level: 'junior',
    skills: ['Python', 'SQL', 'Docker'],
    preference: 'pe',
    ...overrides,
  }
}

test('keeps public offer metadata when the page shell hides the rendered job', () => {
  const cleaned = cleanOfferText(
    '<meta property="og:description" content="Practicante de Tecnología. Requisitos: SQL, Phyton y Power BI.">',
  )
  const facts = extractOfferFacts(cleaned, 'data-analyst')

  assert.match(cleaned, /Practicante de Tecnología/)
  assert.deepEqual(facts.technical, ['SQL', 'Power BI', 'Python'])
  assert.equal(facts.level, 'Practicante / Internship')
})

test('returns a source-backed offer title for headings and pasted descriptions', () => {
  const html = `
    <meta property="og:title" content="Data Engineer Intern · Example" />
    <h1>Data Engineer Intern</h1>
    <p>Python, SQL y Airflow. Trabajo remoto para Perú.</p>
  `

  assert.equal(extractOfferTitle(html), 'Data Engineer Intern')
  assert.equal(
    extractOfferTitle(
      'Example Labs\nBuscamos Data Analyst Junior con Python y SQL. Trabajo remoto para Perú.',
    ),
    'Data Analyst Junior',
  )
  assert.equal(
    extractOfferTitle('Practicante de Tecnología. Requisitos: SQL, Python y Power BI.'),
    'Practicante de Tecnología',
  )
})

function factor(result, id) {
  const value = result.factors.find((current) => current.id === id)
  assert.ok(value, `missing factor ${id}`)
  return value
}

function assertFrontendShape(result) {
  assert.deepEqual(Object.keys(result).sort(), frontendKeys)
  assert.ok(['url', 'text'].includes(result.input.type))
  assert.equal(typeof result.offer, 'object')
  assert.ok(result.offer.title === null || typeof result.offer.title === 'string')
  assert.ok(roleIds.includes(result.targetRole.id))
  assert.equal(typeof result.targetRole.label, 'string')
  assert.ok(Number.isInteger(result.compatibility.score))
  assert.ok(result.compatibility.score >= 0 && result.compatibility.score <= 100)
  assert.ok(
    ['Alta compatibilidad', 'Compatibilidad parcial', 'Baja compatibilidad'].includes(
      result.compatibility.label,
    ),
  )
  assert.ok(
    ['Vale la pena postular', 'Revisar brechas', 'No es prioritaria'].includes(
      result.compatibility.recommendation,
    ),
  )
  assert.ok(['profile', 'target'].includes(result.compatibility.scope))
  assert.ok(Array.isArray(result.factors))
  assert.ok(Array.isArray(result.requirements.technical))
  assert.ok(Array.isArray(result.requirements.preferred))
  assert.ok(Array.isArray(result.profile.matched))
  assert.ok(Array.isArray(result.profile.gaps))
  assert.ok(Array.isArray(result.evidence))
  assert.equal(typeof result.explanation, 'string')
  assert.ok(Array.isArray(result.limitations))
}

test('exposes exactly the six target roles shown by the analyzer', () => {
  assert.deepEqual(Object.keys(targetRoles), roleIds)
  assert.deepEqual(Object.values(targetRoles), [
    'Data Analyst',
    'Data Engineer',
    'Backend Developer',
    'Cloud / DevOps',
    'IA / Machine Learning',
    'Otro',
  ])
})

test('calculates the documented score from visible deterministic factors', () => {
  const result = calculateCompatibility({
    requirements: offerRequirements(),
    profile: userProfile(),
    semanticSimilarity: 0.8,
  })

  assert.deepEqual(result.compatibility, {
    score: 83,
    label: 'Alta compatibilidad',
    recommendation: 'Vale la pena postular',
    scope: 'profile',
  })
  assert.deepEqual(
    result.factors.map(({ id, score, weight, contribution, available }) => ({
      id,
      score,
      weight,
      contribution,
      available,
    })),
    [
      {
        id: 'technical-skills',
        score: 75,
        weight: 50,
        contribution: 37.5,
        available: true,
      },
      {
        id: 'semantic-similarity',
        score: 80,
        weight: 25,
        contribution: 20,
        available: true,
      },
      {
        id: 'experience-level',
        score: 100,
        weight: 15,
        contribution: 15,
        available: true,
      },
      {
        id: 'location-work-mode',
        score: 100,
        weight: 10,
        contribution: 10,
        available: true,
      },
    ],
  )
  assert.deepEqual(result.profile, {
    provided: true,
    matched: ['Python', 'SQL', 'Docker'],
    gaps: ['Airflow'],
  })
})

test('uses stable label and recommendation thresholds at 75 and 45', () => {
  const high = calculateCompatibility({
    requirements: offerRequirements({ technical: ['Python'] }),
    profile: userProfile({ skills: ['Python'] }),
    semanticSimilarity: 0,
  })
  assert.equal(high.compatibility.score, 75)
  assert.equal(high.compatibility.label, 'Alta compatibilidad')
  assert.equal(high.compatibility.recommendation, 'Vale la pena postular')

  const partial = calculateCompatibility({
    requirements: offerRequirements({ technical: ['A', 'B', 'C', 'D', 'E'] }),
    profile: userProfile({ skills: ['A', 'B'] }),
    semanticSimilarity: 0,
  })
  assert.equal(partial.compatibility.score, 45)
  assert.equal(partial.compatibility.label, 'Compatibilidad parcial')
  assert.equal(partial.compatibility.recommendation, 'Revisar brechas')

  const low = calculateCompatibility({
    requirements: offerRequirements({ technical: ['A', 'B', 'C', 'D', 'E'] }),
    profile: userProfile({ level: 'internship', skills: ['A', 'B', 'C'] }),
    semanticSimilarity: 0.16,
  })
  assert.equal(low.compatibility.score, 44)
  assert.equal(low.compatibility.label, 'Baja compatibilidad')
  assert.equal(low.compatibility.recommendation, 'No es prioritaria')
})

test('does not claim personal compatibility without skills and reweights only available factors', () => {
  const result = calculateCompatibility({
    requirements: offerRequirements(),
    profile: userProfile({ skills: [] }),
    semanticSimilarity: 0.8,
  })

  assert.deepEqual(result.compatibility, {
    score: 90,
    label: 'Alta compatibilidad',
    recommendation: 'Vale la pena postular',
    scope: 'target',
  })
  assert.deepEqual(result.profile, { provided: false, matched: [], gaps: [] })
  assert.deepEqual(
    {
      available: factor(result, 'technical-skills').available,
      weight: factor(result, 'technical-skills').weight,
      contribution: factor(result, 'technical-skills').contribution,
    },
    { available: false, weight: 50, contribution: 0 },
  )
  assert.equal(factor(result, 'semantic-similarity').contribution, 40)
  assert.equal(factor(result, 'experience-level').contribution, 30)
  assert.equal(factor(result, 'location-work-mode').contribution, 20)
})

test('shows offer location without scoring it when the profile has no location preference', () => {
  const result = calculateCompatibility({
    requirements: offerRequirements(),
    profile: { level: 'junior', skills: ['Python'] },
    semanticSimilarity: 0.8,
  })
  const locationFactor = factor(result, 'location-work-mode')

  assert.equal(locationFactor.score, null)
  assert.match(locationFactor.detail, /no se usan como preferencia personal/i)
})

test('uses URL and manual text safely, while an explainer cannot change scoring or introduce unsupported fields', async () => {
  const offerText =
    'Buscamos Data Analyst Junior con Python. Trabajo remoto para Perú. Salario: S/ 3,000.'
  const readUrls = []
  const analyzer = createOfferAnalyzer({
    readOffer: async (url) => {
      readUrls.push(url)
      return { text: offerText, originalUrl: url }
    },
    extractRequirements: async () => ({
      technical: ['Python', 'Rust'],
      preferred: ['Tableau'],
      level: 'Junior',
      location: 'Perú',
      workMode: 'remote',
      salary: 'S/ 3,000',
      evidence: [
        { label: 'Tecnologías', text: 'Python' },
        { label: 'Salario', text: 'S/ 3,000' },
        { label: 'Tecnologías', text: 'Rust y Tableau' },
      ],
    }),
    semanticSimilarity: async () => 0.8,
    explain: async () => ({
      explanation: 'Python aparece explícitamente en la oferta.',
      compatibility: { score: 100, label: 'Alta compatibilidad' },
      requirements: { technical: ['Rust'], salary: 'USD 9999' },
      evidence: [{ label: 'Inventado', text: 'Rust y Tableau' }],
    }),
  })

  const url = 'https://jobs.example.test/data-analyst?token=private-offer-token'
  const urlResult = await analyzer.analyze({
    targetRole: 'data-analyst',
    profile: userProfile({ skills: ['Python'] }),
    url,
  })

  assertFrontendShape(urlResult)
  assert.deepEqual(readUrls, [url])
  assert.deepEqual(urlResult.input, { type: 'url', originalUrl: url })
  assert.equal(urlResult.compatibility.score, 95)
  assert.deepEqual(urlResult.requirements.technical, ['Python'])
  assert.deepEqual(urlResult.requirements.preferred, [])
  assert.equal(urlResult.requirements.salary, 'S/ 3,000')
  assert.equal(urlResult.explanation, 'Python aparece explícitamente en la oferta.')
  assert.ok(urlResult.evidence.every((entry) => offerText.includes(entry.text)))
  assert.ok(urlResult.evidence.every((entry) => !entry.text.includes('Rust')))

  const textResult = await analyzer.analyze({
    targetRole: 'data-analyst',
    profile: userProfile({ skills: ['Python'] }),
    description: offerText,
  })
  assertFrontendShape(textResult)
  assert.deepEqual(textResult.input, { type: 'text' })
  assert.deepEqual(readUrls, [url])
})
