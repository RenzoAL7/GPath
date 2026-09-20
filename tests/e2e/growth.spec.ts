import { test, expect } from '@playwright/test'

const result = {
  input: {
    type: 'url',
    originalUrl: 'https://careers.example.com/jobs/data-analyst',
  },
  targetRole: { id: 'data-analyst', label: 'Data Analyst' },
  compatibility: {
    score: 78,
    label: 'Alta compatibilidad',
    recommendation: 'Vale la pena postular',
    scope: 'profile',
  },
  factors: [
    {
      id: 'technical-skills',
      label: 'Habilidades técnicas coincidentes',
      score: 80,
      weight: 50,
      contribution: 40,
      detail: '2 de 3 habilidades técnicas detectadas coinciden con tu perfil.',
    },
    {
      id: 'semantic-similarity',
      label: 'Similitud semántica',
      score: 72,
      weight: 25,
      contribution: 18,
      detail: 'Compara el lenguaje de la oferta con el perfil o puesto objetivo.',
    },
    {
      id: 'experience-level',
      label: 'Nivel de experiencia',
      score: 100,
      weight: 15,
      contribution: 15,
      detail: 'Se contrasta el nivel indicado en tu perfil con el nivel detectado.',
    },
    {
      id: 'location-work-mode',
      label: 'Ubicación y modalidad',
      score: 50,
      weight: 10,
      contribution: 5,
      detail: 'Se contrasta con tu preferencia de Perú, remoto LATAM o cualquiera.',
    },
  ],
  requirements: {
    technical: ['Python', 'SQL', 'Airflow'],
    preferred: ['Tableau'],
    level: 'Junior',
    location: 'Perú',
    workMode: 'Remoto',
    salary: 'S/ 3,000',
  },
  profile: { provided: true, matched: ['Python', 'SQL'], gaps: ['Airflow'] },
  evidence: [
    { label: 'Requisito técnico', text: 'Manejo de Python, SQL y Airflow.' },
    { label: 'Salario', text: 'Salario: S/ 3,000.' },
  ],
  explanation: 'La oferta menciona Python y SQL, que ya agregaste a tu perfil.',
  limitations: ['El puntaje es orientativo y depende del texto público disponible.'],
}

async function addSkills(page: import('@playwright/test').Page, skills = ['Python', 'SQL']) {
  for (const skill of skills) {
    await page.getByLabel('Habilidades actuales').fill(skill)
    await page.getByRole('button', { name: 'Agregar' }).click()
  }
}

test('shows the six target roles and keeps the source empty until the user provides one', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('GPath — Growth Path')
  const mark = page.locator('.brand-mark')
  const iconPath = await page.locator('link[rel="icon"]').getAttribute('href')
  await expect(mark).toHaveAttribute('src', iconPath!)
  await expect(mark).toHaveJSProperty('naturalWidth', 40)
  await expect(page.getByRole('button', { name: /Data Analyst/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Data Engineer/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Backend Developer/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Cloud \/ DevOps/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /IA \/ Machine Learning/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Otro/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Analizar oferta' })).toBeDisabled()
  await expect(page.getByText('El análisis aparecerá aquí.')).toBeVisible()
})

test('adds skills by keyboard and analyzes pasted text without claiming a fabricated original link', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  const skills = page.getByLabel('Habilidades actuales')
  await skills.fill('Python')
  await skills.press('Enter')
  await expect(page.getByLabel('Habilidades agregadas')).toContainText('Python')
  await addSkills(page, ['SQL'])
  await page.getByLabel('Pega el enlace público de la oferta').fill('')
  await page
    .getByLabel('Si no pudimos leer el enlace, pega aquí la descripción de la oferta.')
    .fill(
      'Buscamos Data Analyst Junior con Python y SQL. Trabajo remoto para Perú. Salario: S/ 3,000.',
    )
  await page.getByRole('button', { name: 'Analizar oferta' }).click()
  await expect(page.getByRole('heading', { name: 'Compatibilidad con tu perfil' })).toBeVisible()
  await expect(page.getByText('Descripción pegada por ti')).toBeVisible()
  await expect(page.getByText('Ellos piden')).toBeVisible()
  await expect(page.getByText('Tú cumples')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Te falta', exact: true })).toBeVisible()
  await expect(page.getByText('Evidencias de la oferta')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver oferta original' })).toHaveCount(0)
  await expect(page.getByText('Python', { exact: true }).first()).toBeVisible()
  if (testInfo.project.name === 'desktop')
    await page.screenshot({ path: 'artifacts/analyzer-result-desktop.png', fullPage: true })
})

test('uses one source at a time and sends the selected profile with a URL', async ({ page }) => {
  let received: unknown
  await page.route('**/api/analyze', async (route) => {
    received = route.request().postDataJSON()
    await route.fulfill({ json: result })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /Cloud \/ DevOps/ }).click()
  await page.getByRole('button', { name: 'Internship' }).click()
  await page.getByRole('button', { name: 'Remoto LATAM' }).click()
  await addSkills(page, ['Docker'])
  await page
    .getByLabel('Pega el enlace público de la oferta')
    .fill('https://careers.example.com/jobs/data-analyst')
  await expect(
    page.getByLabel('Si no pudimos leer el enlace, pega aquí la descripción de la oferta.'),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Analizar oferta' }).click()
  await expect(page.getByRole('link', { name: 'Ver oferta original' })).toHaveAttribute(
    'href',
    result.input.originalUrl,
  )
  expect(received).toEqual({
    targetRole: 'cloud-devops',
    profile: { level: 'internship', skills: ['Docker'], preference: 'latam' },
    url: 'https://careers.example.com/jobs/data-analyst',
  })
})

test('shows the real analysis stages while a request is pending', async ({ page }) => {
  let releaseRequest: (() => void) | undefined
  const pending = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  await page.route('**/api/analyze', async (route) => {
    await pending
    await route.fulfill({ json: result })
  })
  await page.goto('/')
  await page
    .getByLabel('Si no pudimos leer el enlace, pega aquí la descripción de la oferta.')
    .fill('Buscamos Data Analyst Junior con Python y SQL. Trabajo remoto para Perú.')
  await page.getByRole('button', { name: 'Analizar oferta' }).click()
  await expect(page.getByLabel('Progreso del análisis')).toContainText('Leyendo la oferta.')
  await expect(page.getByLabel('Progreso del análisis')).toContainText('Extrayendo requisitos.')
  await expect(page.getByLabel('Progreso del análisis')).toContainText('Comparando con tu perfil.')
  await expect(page.getByLabel('Progreso del análisis')).toContainText('Generando la explicación.')
  releaseRequest?.()
  await expect(page.getByLabel('Progreso del análisis')).toHaveCount(0)
})

test('labels an analysis without skills as compatibility with the target role', async ({ page }) => {
  await page.route('**/api/analyze', (route) =>
    route.fulfill({
      json: {
        ...result,
        input: { type: 'text' },
        compatibility: { ...result.compatibility, score: 66, scope: 'target' },
        profile: { provided: false, matched: [], gaps: [] },
      },
    }),
  )
  await page.goto('/')
  await page
    .getByLabel('Si no pudimos leer el enlace, pega aquí la descripción de la oferta.')
    .fill('Buscamos Data Analyst Junior con Python y SQL. Trabajo remoto para Perú.')
  await page.getByRole('button', { name: 'Analizar oferta' }).click()
  await expect(page.getByRole('heading', { name: 'Compatibilidad con el puesto objetivo' })).toBeVisible()
  await expect(page.getByText(/Perfil incompleto: agrega tus habilidades actuales/)).toBeVisible()
})

test('keeps the previous result after an error and offers a retry', async ({ page }) => {
  let calls = 0
  await page.route('**/api/analyze', (route) => {
    calls++
    if (calls === 1) return route.fulfill({ json: result })
    if (calls === 2) return route.fulfill({ status: 503, body: '{}' })
    return route.fulfill({ json: result })
  })
  await page.goto('/')
  await page
    .getByLabel('Si no pudimos leer el enlace, pega aquí la descripción de la oferta.')
    .fill('Buscamos Data Analyst Junior con Python y SQL. Trabajo remoto para Perú.')
  await page.getByRole('button', { name: 'Analizar oferta' }).click()
  await expect(page.getByRole('heading', { name: 'Compatibilidad con el puesto objetivo' })).toBeVisible()
  await page.getByRole('button', { name: 'Analizar oferta' }).click()
  await expect(page.getByRole('alert')).toContainText('Se mantiene el último resultado')
  await page.getByRole('button', { name: 'Reintentar análisis' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('narrow layout has no horizontal overflow and records a real screenshot', async ({ page }, testInfo) => {
  await page.goto('/')
  if (testInfo.project.name === 'desktop')
    await page.screenshot({ path: 'artifacts/analyzer-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 320, height: 720 })
  await page.screenshot({ path: `artifacts/analyzer-320-${testInfo.project.name}.png`, fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true)
})
