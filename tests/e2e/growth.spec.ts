import { test, expect, type Page } from '@playwright/test'

const offerUrl = 'https://careers.example.com/jobs/data-analyst'

const result = {
  input: { type: 'url', originalUrl: offerUrl },
  offer: { title: 'Data Analyst Junior' },
  targetRole: { id: 'other', label: 'Otro' },
  compatibility: { score: 60, label: 'Parcial', recommendation: 'Revisa', scope: 'target' },
  factors: [],
  requirements: {
    technical: ['Python', 'SQL', 'Airflow'],
    preferred: ['Tableau'],
    level: 'Junior',
    location: 'Perú',
    workMode: 'Remoto',
    salary: 'S/ 3,000',
  },
  profile: { provided: false, matched: [], gaps: [] },
  alerts: [],
  evidence: [
    { label: 'Requisito técnico', text: 'Manejo de Python, SQL y Airflow.' },
    { label: 'Deseable', text: 'Deseable: Tableau.' },
    { label: 'Salario', text: 'Salario: S/ 3,000.' },
  ],
  explanation: 'La oferta menciona Python y SQL.',
  limitations: ['El análisis depende del texto público disponible.'],
}

/** Builds a small valid PDF, so the real browser reader runs in these tests. */
function pdf(lines: string[]) {
  const escaped = lines.map((line) => `(${line.replace(/[()\\]/g, '\\$&')}) Tj T*`).join('\n')
  const stream = `BT /F1 12 Tf 72 720 Td 16 TL\n${escaped}\nET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const offset = body.length
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const start = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}

const cvLines = [
  'CV de una persona ficticia para pruebas automaticas',
  'Proyecto de ventas con consultas en SQL para cruzar pedidos.',
  'Automatizacion de reportes con Python y limpieza de datos.',
  'Tambien presente resultados al equipo comercial.',
]

function mockAnalysis(page: Page, json: unknown = result) {
  return page.route('**/api/analyze', (route) => route.fulfill({ json }))
}

async function uploadCv(page: Page, buffer = pdf(cvLines), name = 'cv-ana-prueba.pdf') {
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType: 'application/pdf', buffer })
}

async function readOffer(page: Page) {
  await page.getByLabel('Enlace de la oferta').fill(offerUrl)
  await page.getByRole('button', { name: 'Ver mi ruta' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Data Analyst Junior' })).toBeVisible()
}

test('starts with the offer, an optional CV and a keyboard-visible focus', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.locator('.brand')).toBeFocused()
  await expect(page.locator('.brand')).toHaveCSS('outline-style', 'solid')
  await expect(page).toHaveTitle('GrowPath — Ruta para postular')
  await expect(
    page.getByRole('heading', { name: '¿Vas a postular? Pega la oferta.' }),
  ).toBeVisible()
  await expect(page.getByText('Ruta para postular', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ver mi ruta' })).toBeDisabled()
  await expect(page.getByText(/no se envía a nuestro servidor/)).toBeVisible()
  await expect(page.getByLabel('Descripción de la oferta')).toHaveCount(0)
})

test('the real API turns a pasted offer into the five-stop route', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: '¿No abre? Pega la descripción.' }).click()
  await page
    .getByLabel('Descripción de la oferta')
    .fill(
      'Buscamos Data Analyst Junior con Python y SQL. Trabajo remoto para Perú. Salario: S/ 3,000.',
    )
  await page.getByRole('button', { name: 'Ver mi ruta' }).click()
  for (const name of ['¿Es confiable?', 'Lo que piden', 'Lo que te falta', 'Qué destacar']) {
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }
  await expect(page.getByRole('heading', { name: 'Postula' })).toBeVisible()
  await expect(page.getByText(/No encontramos pedidos de pago/)).toBeVisible()
  await expect(page.getByText(/Eso no garantiza/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Python/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver oferta original' })).toHaveCount(0)
  await expect(page.getByText(/Pegaste esta oferta a mano/)).toBeVisible()
  await page.screenshot({
    path: `artifacts/ruta-sin-cv-${testInfo.project.name}.png`,
    fullPage: true,
  })
})

test('each requirement opens the quote that supports it', async ({ page }) => {
  await mockAnalysis(page)
  await page.goto('/')
  await readOffer(page)
  const python = page.getByRole('button', { name: /Python/ })
  await expect(python).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('mark')).toHaveText('Manejo de Python, SQL y Airflow.')
  await page.getByRole('button', { name: /Tableau/ }).click()
  await expect(python).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('mark')).toHaveText('Deseable: Tableau.')
  await expect(page.getByRole('link', { name: 'Ver oferta original' })).toHaveAttribute(
    'href',
    offerUrl,
  )
})

test('shows scam signals with their quotes and never calls an offer safe', async ({
  page,
}, testInfo) => {
  await mockAnalysis(page, {
    ...result,
    alerts: [
      {
        id: 'payment',
        label: 'Pide un pago',
        text: 'Deberás abonar S/ 80 por el curso de inducción.',
      },
      {
        id: 'sensitive-data',
        label: 'Pide datos sensibles',
        text: 'Envía una foto de tu DNI.',
      },
    ],
  })
  await page.goto('/')
  await readOffer(page)
  await expect(page.getByText('Encontramos 2 señales de posible estafa')).toBeVisible()
  await expect(page.getByText('«Deberás abonar S/ 80 por el curso de inducción.»')).toBeVisible()
  await expect(page.getByText(/No pagues ni envíes tu DNI/)).toBeVisible()
  await expect(page.getByText(/oferta segura/i)).toHaveCount(0)
  await page.screenshot({
    path: `artifacts/ruta-alerta-${testInfo.project.name}.png`,
    fullPage: true,
  })
})

test('a real PDF is compared in the tab and never reaches the server', async ({
  page,
}, testInfo) => {
  const bodies: string[] = []
  const blocked: string[] = []
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) blocked.push(message.text())
  })
  page.on('request', (request) => {
    const data = request.postData()
    if (data) bodies.push(data)
  })
  await mockAnalysis(page)
  await page.goto('/')
  await uploadCv(page)
  await expect(page.getByText(/cv-ana-prueba\.pdf/)).toBeVisible()
  await readOffer(page)

  await expect(page.getByText('Tienes 2 de 3 técnicos')).toBeVisible()
  await expect(page.getByRole('button', { name: /Python.*Lo tienes/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Airflow.*Te falta/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Tableau.*Te falta/ })).toBeVisible()
  await expect(
    page.locator('.requirement-quotes').getByText(/Automatizacion de reportes con Python/),
  ).toBeVisible()
  await expect(page.getByText(/Airflow.* es requisito/)).toBeVisible()
  await expect(page.getByText(/Tableau.* es deseable/)).toBeVisible()
  await expect(page.getByText(/Tu mejor ejemplo es «/)).toBeVisible()

  expect(bodies).toEqual([
    JSON.stringify({
      targetRole: 'other',
      profile: { level: 'junior', skills: [] },
      url: offerUrl,
    }),
  ])
  expect(bodies.join(' ')).not.toMatch(/ventas|Automatizacion|cv-ana/)
  expect(blocked).toEqual([])
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 800 })
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true)
  await page.screenshot({ path: `artifacts/ruta-cv-${testInfo.project.name}.png`, fullPage: true })
})

test('the CV can be deleted and added again without reading the offer twice', async ({ page }) => {
  let calls = 0
  await page.route('**/api/analyze', (route) => {
    calls++
    return route.fulfill({ json: result })
  })
  await page.goto('/')
  await readOffer(page)
  await expect(page.getByText(/Agrega tu CV/)).toBeVisible()
  await expect(page.getByText('Lo tienes')).toHaveCount(0)

  await uploadCv(page)
  await expect(page.getByText('Tienes 2 de 3 técnicos')).toBeVisible()
  await page.getByRole('button', { name: 'Borrar mi CV ahora' }).click()
  await expect(page.getByText(/Comparado con/)).toHaveCount(0)
  await expect(page.getByText('Tienes 2 de 3 técnicos')).toHaveCount(0)
  await expect(page.getByText(/Agrega tu CV/)).toBeVisible()
  expect(calls).toBe(1)
})

test('a reload deletes the CV', async ({ page }) => {
  await page.goto('/')
  await uploadCv(page)
  await expect(page.getByText(/cv-ana-prueba\.pdf/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/cv-ana-prueba\.pdf/)).toHaveCount(0)
})

test('skills can be typed when there is no usable PDF', async ({ page }) => {
  await mockAnalysis(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Prefiero escribir mis habilidades' }).click()
  await page.getByLabel('Tus habilidades, separadas por comas').fill('sql, airflow')
  await page.getByRole('button', { name: 'Usar' }).click()
  await readOffer(page)
  await expect(page.getByText('Tienes 2 de 3 técnicos')).toBeVisible()
  await page.getByRole('button', { name: /SQL/ }).click()
  await expect(page.getByText('lo indicaste tú.')).toBeVisible()
})

test('explains CVs it cannot use', async ({ page }) => {
  await page.goto('/')
  await uploadCv(page, pdf([]))
  await expect(page.getByRole('alert')).toContainText('Parece un PDF escaneado')
  await uploadCv(page, Buffer.alloc(2_000_001, 'a'))
  await expect(page.getByRole('alert')).toContainText('pesa más de 2 MB')
  await uploadCv(page, Buffer.from('esto no es un pdf'), 'notas.pdf')
  await expect(page.getByRole('alert')).toContainText('no es un PDF')
  await uploadCv(
    page,
    pdf(['Experiencia atendiendo clientes en tienda durante dos veranos seguidos']),
  )
  await expect(page.getByRole('alert')).toContainText('No reconocimos habilidades')
})

test('uses one source at a time and turns a LinkedIn search into an offer', async ({ page }) => {
  await page.route('**/api/analyze', async (route) => {
    expect(route.request().postDataJSON().url).toBe('https://www.linkedin.com/jobs/view/4463490846')
    await route.fulfill({ json: result })
  })
  await page.goto('/')
  await page
    .getByLabel('Enlace de la oferta')
    .fill('https://www.linkedin.com/jobs/search-results/?currentJobId=4463490846')
  await page.getByRole('button', { name: '¿No abre? Pega la descripción.' }).click()
  await expect(page.getByLabel('Descripción de la oferta')).toBeDisabled()
  await page.getByRole('button', { name: 'Ocultar descripción' }).click()
  await expect(page.getByLabel('Descripción de la oferta')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver mi ruta' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Data Analyst Junior' })).toBeVisible()
})

test('explains when a LinkedIn URL is only a search without a selected offer', async ({ page }) => {
  await page.goto('/')
  await page
    .getByLabel('Enlace de la oferta')
    .fill('https://www.linkedin.com/jobs/search-results/?keywords=data%20engineer')
  await expect(page.getByText(/Ese enlace es una búsqueda de LinkedIn/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ver mi ruta' })).toBeDisabled()
})

test('keeps the loading state visible while a request is pending', async ({ page }) => {
  let release: (() => void) | undefined
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/analyze', async (route) => {
    await pending
    await route.fulfill({ json: result })
  })
  await page.goto('/')
  await page.getByLabel('Enlace de la oferta').fill(offerUrl)
  const startedAt = Date.now()
  await page.getByRole('button', { name: 'Ver mi ruta' }).click()
  await expect(page.getByRole('status')).toContainText('Estamos armando tu ruta')
  await expect(page.getByLabel('Progreso del análisis')).toContainText('Leyendo la oferta')
  release?.()
  await expect(page.getByRole('heading', { level: 1, name: 'Data Analyst Junior' })).toBeVisible()
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(850)
  await expect(page.getByRole('heading', { level: 1, name: 'Data Analyst Junior' })).toBeFocused()
})

test('offers a retry when reading fails and shows the wait time at the limit', async ({ page }) => {
  let calls = 0
  await page.route('**/api/analyze', (route) => {
    calls++
    if (calls === 1) return route.fulfill({ status: 503, body: '{}' })
    if (calls === 2)
      return route.fulfill({
        status: 429,
        json: {
          error: 'Hiciste varios análisis seguidos. Espera 42 segundos y vuelve a intentarlo.',
        },
      })
    return route.fulfill({ json: result })
  })
  await page.goto('/')
  await page.getByLabel('Enlace de la oferta').fill(offerUrl)
  await page.getByRole('button', { name: 'Ver mi ruta' }).click()
  await expect(page.getByRole('alert')).toContainText('No pudimos analizar la oferta')
  await page.getByRole('button', { name: 'Reintentar lectura' }).click()
  await expect(page.getByRole('alert')).toContainText('Espera 42 segundos')
  await expect(page.getByLabel('Enlace de la oferta')).toHaveValue(offerUrl)
  await page.getByRole('button', { name: 'Reintentar lectura' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Data Analyst Junior' })).toBeVisible()
})

test('reading another offer returns to the start and keeps the CV', async ({ page }) => {
  await mockAnalysis(page)
  await page.goto('/')
  await uploadCv(page)
  await expect(page.getByText(/cv-ana-prueba\.pdf/)).toBeVisible()
  await readOffer(page)
  await page.getByRole('button', { name: 'Leer otra oferta' }).click()
  await expect(page.getByLabel('Enlace de la oferta')).toHaveValue('')
  await expect(page.getByText(/cv-ana-prueba\.pdf/)).toBeVisible()
})

const manyGaps = {
  ...result,
  requirements: {
    ...result.requirements,
    technical: ['Python', 'SQL', 'MongoDB', 'Airflow'],
    preferred: ['BigQuery', 'GCP'],
  },
}

test('groups what is missing and picks real experience as the example', async ({
  page,
}, testInfo) => {
  await mockAnalysis(page, manyGaps)
  await page.goto('/')
  await uploadCv(
    page,
    pdf([
      'Lenguajes: Python, SQL, Java, Go, JavaScript.',
      'Proyecto de ventas: cruce de pedidos con SQL y reportes mensuales.',
    ]),
  )
  await expect(page.getByText(/cv-ana-prueba\.pdf/)).toBeVisible()
  await readOffer(page)
  const missing = page.locator('.plain-list li')
  await expect(missing).toHaveCount(2)
  await expect(missing.first()).toContainText('MongoDB y Airflow son requisitos')
  await expect(missing.first()).toContainText('Si manejas alguno, agrégalo a tu CV')
  await expect(missing.last()).toContainText('BigQuery y GCP son deseables')
  await expect(page.getByText(/Prepara|prepara/)).toHaveCount(0)
  const demonstrate = page.getByText(/Tu mejor ejemplo es/)
  await expect(demonstrate).toContainText('Proyecto de ventas')
  await expect(demonstrate).toContainText('Conecta con SQL')
  await expect(demonstrate).not.toContainText('Lenguajes:')
  await expect(page.getByText(/Separa 2 habilidades deseables/)).toBeVisible()
  await page.screenshot({
    path: `artifacts/ruta-sin-repetir-${testInfo.project.name}.png`,
    fullPage: true,
  })
})

test('does not demand proof when the CV only lists tools', async ({ page }) => {
  await mockAnalysis(page, manyGaps)
  await page.goto('/')
  await uploadCv(page, pdf(['Lenguajes: Python, SQL, Java, Go, JavaScript, TypeScript, Docker.']))
  await expect(page.getByText(/cv-ana-prueba\.pdf/)).toBeVisible()
  await readOffer(page)
  await expect(page.getByText(/Tu CV ya menciona Python y SQL\. Si te preguntan/)).toBeVisible()
  await expect(page.getByText(/Tu mejor ejemplo es/)).toHaveCount(0)
})

test('the CV picker and the requirements work from the keyboard', async ({ page }) => {
  await mockAnalysis(page)
  await page.goto('/')
  await page.getByLabel('Enlace de la oferta').fill(offerUrl)
  await page.getByRole('button', { name: '¿No abre? Pega la descripción.' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('#home-cv')).toBeFocused()
  await expect(page.locator('.cv-drop')).toHaveCSS('outline-style', 'solid')
  await page.getByRole('button', { name: 'Ver mi ruta' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Data Analyst Junior' })).toBeFocused()
  const sql = page.getByRole('button', { name: /SQL/ })
  await sql.focus()
  await expect(sql).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Enter')
  await expect(sql).toHaveAttribute('aria-expanded', 'true')
})

test('narrow layout has no horizontal overflow and records a real screenshot', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.screenshot({ path: `artifacts/inicio-${testInfo.project.name}.png`, fullPage: true })
  await page.setViewportSize({ width: 320, height: 720 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320)
  await page.screenshot({
    path: `artifacts/inicio-320-${testInfo.project.name}.png`,
    fullPage: true,
  })
})
