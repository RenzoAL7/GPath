import { test, expect } from '@playwright/test'

const result = {
  input: {
    type: 'url',
    originalUrl: 'https://careers.example.com/jobs/data-analyst',
  },
  offer: { title: 'Data Analyst Junior' },
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
      score: null,
      weight: 10,
      contribution: 0,
      detail:
        'La ubicación y modalidad se muestran como datos de la oferta; no se usan como preferencia personal.',
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
  explanation:
    'La oferta menciona Python y SQL. Revisa las evidencias y condiciones detectadas antes de postular.',
  limitations: ['El análisis depende del texto público disponible.'],
}

test('starts with a centered source step and no target-role panel', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('GPath — Analizador de ofertas')
  await expect(
    page.getByRole('heading', { name: 'Entiende una oferta antes de postular' }),
  ).toBeVisible()
  await expect(page.locator('header').getByText('GPath', { exact: true })).toHaveCount(0)
  await expect(page.getByAltText('Ícono de GPath')).toBeVisible()
  await expect(page.getByText('¿Qué puesto buscas?')).toHaveCount(0)
  await expect(page.getByText('Tu perfil')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Data Analyst/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Leer oferta' })).toBeDisabled()
  await expect(page.getByText('Pega el enlace de una oferta')).toBeVisible()
  await expect(page.getByLabel('Pega la descripción de la oferta')).toHaveCount(0)
})

test('reads pasted text and then shows the general offer analysis', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'No puedo abrir el enlace' }).click()
  await page
    .getByLabel('Pega la descripción de la oferta')
    .fill(
      'Buscamos Data Analyst Junior con Python y SQL. Trabajo remoto para Perú. Salario: S/ 3,000.',
    )
  await page.getByRole('button', { name: 'Leer oferta' }).click()
  await expect(page.getByRole('heading', { name: 'Esto es lo que encontramos' })).toBeVisible()
  await expect(page.getByText('Data Analyst Junior', { exact: true })).toBeVisible()
  await expect(page.getByText('Requisitos técnicos')).toBeVisible()
  if (testInfo.project.name === 'desktop')
    await page.screenshot({ path: 'artifacts/analyzer-requirements-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Ver análisis general' }).click()
  await expect(page.getByRole('heading', { name: 'Análisis general de la oferta' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '¿Para quién puede ser este puesto?' }),
  ).toBeVisible()
  await expect(page.getByText(/Este puesto puede ser una buena opción para quienes/)).toBeVisible()
  await expect(page.getByText('Data Analyst Junior', { exact: true })).toBeVisible()
  await expect(page.getByText('Lo que piden')).toBeVisible()
  await expect(page.getByText('Compatibilidad con tu perfil')).toHaveCount(0)
  await expect(page.getByText('Tú cumples')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Te falta', exact: true })).toHaveCount(0)
  await expect(page.getByText('Evidencias de la oferta')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver oferta original' })).toHaveCount(0)
  await expect(page.getByText('Python', { exact: true }).first()).toBeVisible()
  if (testInfo.project.name === 'desktop')
    await page.screenshot({ path: 'artifacts/analyzer-result-desktop.png', fullPage: true })
})

test('returns to the detected requirements without reading the offer again', async ({ page }) => {
  let calls = 0
  await page.route('**/api/analyze', async (route) => {
    calls++
    await route.fulfill({ json: result })
  })
  await page.goto('/')
  await page
    .getByLabel('Enlace público de la oferta')
    .fill('https://careers.example.com/jobs/data-analyst')
  await page.getByRole('button', { name: 'Leer oferta' }).click()
  await page.getByRole('button', { name: 'Ver análisis general' }).click()
  await page.getByRole('button', { name: 'Revisar requisitos' }).click()

  await expect(page.getByRole('heading', { name: 'Esto es lo que encontramos' })).toBeVisible()
  await expect(page.getByText('Data Analyst Junior', { exact: true })).toBeVisible()
  await expect(page.getByText('Requisitos técnicos')).toBeVisible()
  expect(calls).toBe(1)
})

test('uses one source at a time and sends the general analysis request with a URL', async ({
  page,
}) => {
  const received: unknown[] = []
  await page.route('**/api/analyze', async (route) => {
    received.push(route.request().postDataJSON())
    await route.fulfill({ json: result })
  })
  await page.goto('/')
  await page
    .getByLabel('Enlace público de la oferta')
    .fill('https://careers.example.com/jobs/data-analyst')
  await expect(page.getByLabel('Pega la descripción de la oferta')).toHaveCount(0)
  await page.getByRole('button', { name: 'Leer oferta' }).click()
  await page.getByRole('button', { name: 'Ver análisis general' }).click()
  await expect(page.getByRole('link', { name: 'Ver oferta original' })).toHaveAttribute(
    'href',
    result.input.originalUrl,
  )
  expect(received).toEqual([
    {
      targetRole: 'other',
      profile: { level: 'junior', skills: [] },
      url: 'https://careers.example.com/jobs/data-analyst',
    },
  ])
})

test('offers a manual description only as a fallback input', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('Pega la descripción de la oferta')).toHaveCount(0)
  await page.getByRole('button', { name: 'No puedo abrir el enlace' }).click()
  await expect(page.getByLabel('Pega la descripción de la oferta')).toBeVisible()
  await page.getByRole('button', { name: 'Ocultar alternativa' }).click()
  await expect(page.getByLabel('Pega la descripción de la oferta')).toHaveCount(0)
})

test('turns a LinkedIn search link with a selected job into an individual offer URL', async ({
  page,
}) => {
  await page.route('**/api/analyze', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    expect(body.url).toBe('https://www.linkedin.com/jobs/view/4463490846')
    await route.fulfill({ json: result })
  })
  await page.goto('/')
  await page
    .getByLabel('Enlace público de la oferta')
    .fill('https://www.linkedin.com/jobs/search-results/?currentJobId=4463490846')
  await expect(page.getByText(/Ese enlace es una búsqueda de LinkedIn/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Leer oferta' }).click()
  await expect(page.getByText('Esto es lo que encontramos')).toBeVisible()
})

test('explains when a LinkedIn URL is only a search without a selected offer', async ({ page }) => {
  await page.goto('/')
  await page
    .getByLabel('Enlace público de la oferta')
    .fill('https://www.linkedin.com/jobs/search-results/?keywords=data%20engineer')
  await expect(page.getByText(/Ese enlace es una búsqueda de LinkedIn/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Leer oferta' })).toBeDisabled()
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
  await page.getByRole('button', { name: 'No puedo abrir el enlace' }).click()
  await page
    .getByLabel('Pega la descripción de la oferta')
    .fill('Buscamos Data Analyst Junior con Python y SQL. Trabajo remoto para Perú.')
  await page.getByRole('button', { name: 'Leer oferta' }).click()
  await expect(page.getByLabel('Progreso del análisis')).toContainText('Leyendo la oferta.')
  await expect(page.getByLabel('Progreso del análisis')).toContainText('Extrayendo requisitos.')
  await expect(page.getByLabel('Progreso del análisis')).toContainText('Organizando los hallazgos.')
  await expect(page.getByLabel('Progreso del análisis')).toContainText('Generando la explicación.')
  releaseRequest?.()
  await expect(page.getByLabel('Progreso del análisis')).toHaveCount(0)
})

test('offers a retry when reading the offer fails', async ({ page }) => {
  let calls = 0
  await page.route('**/api/analyze', (route) => {
    calls++
    if (calls === 1) return route.fulfill({ status: 503, body: '{}' })
    return route.fulfill({ json: result })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'No puedo abrir el enlace' }).click()
  await page
    .getByLabel('Pega la descripción de la oferta')
    .fill('Buscamos Data Analyst Junior con Python y SQL. Trabajo remoto para Perú.')
  await page.getByRole('button', { name: 'Leer oferta' }).click()
  await expect(page.getByRole('alert')).toContainText('No pudimos analizar la oferta')
  await page.getByRole('button', { name: 'Reintentar lectura' }).click()
  await expect(page.getByRole('heading', { name: 'Esto es lo que encontramos' })).toBeVisible()
})

test('narrow layout has no horizontal overflow and records a real screenshot', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  if (testInfo.project.name === 'desktop')
    await page.screenshot({ path: 'artifacts/analyzer-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 320, height: 720 })
  await page.screenshot({
    path: `artifacts/analyzer-320-${testInfo.project.name}.png`,
    fullPage: true,
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true)
})
