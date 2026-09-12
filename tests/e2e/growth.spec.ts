import { test, expect } from '@playwright/test'

test('demo calculates entry-level roles and shows the supporting examples', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('GPath — Growth Path')
  const mark = page.locator('.brand-mark')
  const iconPath = await page.locator('link[rel="icon"]').getAttribute('href')
  await expect(mark).toHaveAttribute('src', iconPath!)
  await expect(mark).toHaveJSProperty('naturalWidth', 40)
  await expect(page.getByText('Demo local', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Puesto')).toHaveValue('data-intern')
  await expect(page.getByLabel('Puesto').locator('option')).toHaveCount(26)
  await expect(page.locator('#results-title')).toHaveText('Data Intern')
  await expect(page.locator('.job-card')).toHaveCount(4)
  await expect(page.getByRole('progressbar', { name: 'Python: 4 de 4 ofertas' })).toHaveAttribute(
    'value',
    '100',
  )

  await page.getByLabel('Puesto').selectOption('devops-intern')
  await expect(page.getByText(/Hay filtros pendientes de aplicar/)).toBeVisible()
  await page.getByRole('button', { name: 'Ver tecnologías' }).click()
  await expect(page.locator('#results-title')).toHaveText('DevOps Intern')
  await expect(page.getByRole('progressbar', { name: 'Linux: 4 de 4 ofertas' })).toHaveAttribute(
    'value',
    '100',
  )

  await page.getByLabel('Puesto').selectOption('data-engineer-intern')
  await page.getByRole('button', { name: 'Ver tecnologías' }).click()
  await expect(page.locator('#results-title')).toHaveText('Data Engineer Intern')

  await page.getByLabel('Puesto').selectOption('qa-intern')
  await page.getByRole('button', { name: 'Ver tecnologías' }).click()
  await expect(page.locator('#results-title')).toHaveText('QA Automation Intern')
  await expect(page.locator('.example-only')).toHaveCount(4)
})

test('technology filters evidence and resets on a successful query', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.job-card')).toHaveCount(4)
  await page.getByRole('button', { name: 'Docker', exact: true }).click()
  await expect(page.locator('.job-card')).toHaveCount(1)
  await expect(page.locator('.job-card .tags')).toContainText('Docker')
  await expect(page.locator('.skill-chart .is-selected')).toContainText('Docker')
  await page.getByRole('button', { name: /Quitar filtro/ }).click()
  await expect(page.locator('.job-card')).toHaveCount(4)
  await page.getByRole('button', { name: 'Docker', exact: true }).click()
  await page.getByLabel('Puesto').selectOption('backend-intern')
  await page.getByRole('button', { name: 'Ver tecnologías' }).click()
  await expect(page.locator('#results-title')).toHaveText('Backend Intern')
  await expect(page.getByRole('button', { name: /Quitar filtro/ })).toHaveCount(0)
  await expect(page.locator('.job-card')).toHaveCount(4)
})

test('loading reserves space and updating keeps previous evidence visible', async ({ page }) => {
  let release!: () => void
  let gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/jobs?*', async (route) => {
    await gate
    await route.continue()
  })
  await page.goto('/')
  await expect(page.locator('.loading-placeholder')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Actualizando…' })).toBeDisabled()
  release()
  await expect(page.locator('.job-card')).toHaveCount(4)
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.getByLabel('Puesto').selectOption('backend-intern')
  await page.getByRole('button', { name: 'Ver tecnologías' }).click()
  await expect(page.locator('.update-note')).toBeVisible()
  await expect(page.locator('.job-card')).toHaveCount(4)
  await expect(page.locator('#results-title')).toHaveText('Data Intern')
  release()
  await expect(page.locator('#results-title')).toHaveText('Backend Intern')
  await expect(page.locator('.update-note')).toHaveCount(0)
})

test('tablet keeps filters and results within the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto('/')
  await expect(page.locator('.job-card')).toHaveCount(4)
  await expect(page.locator('.job-card').first().locator('> :first-child')).toHaveJSProperty(
    'tagName',
    'H3',
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: `artifacts/refinement-tablet-${testInfo.project.name}.png`,
    fullPage: true,
  })
})

test('technology filter supports keyboard interaction', async ({ page }) => {
  await page.goto('/')
  const docker = page.getByRole('button', { name: 'Docker', exact: true })
  await docker.focus()
  await page.keyboard.press('Enter')
  await expect(docker).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.job-card')).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(page.locator('.job-card')).toHaveCount(4)
})

test('region and country filters show only matching examples', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.job-card')).toHaveCount(4)
  await page.getByLabel('Puesto').selectOption('backend-intern')
  await page.getByRole('button', { name: 'LATAM' }).click()
  await page.getByLabel('País o cobertura').selectOption('pe')
  await page.getByLabel('Modalidad').selectOption('onsite')
  await page.getByRole('button', { name: 'Ver tecnologías' }).click()
  await expect(page.locator('#results-title')).toHaveText('Backend Intern')
  await expect(page.locator('.job-card')).toHaveCount(1)
  await expect(page.locator('.location')).toHaveText('Lima, Perú · presencial')
  await expect(page).toHaveURL(/role=backend-intern.*region=latam.*country=pe.*workMode=onsite/)
})

test('unknown location inside LATAM is an explicit zero-result state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'LATAM' }).click()
  await page.getByLabel('País o cobertura').selectOption('unknown')
  await page.getByRole('button', { name: 'Ver tecnologías' }).click()
  await expect(page.locator('.empty-state')).toContainText('No hay ofertas con estos filtros')
  await expect(page.locator('.job-card')).toHaveCount(0)
  await expect(page.getByText('0 ejemplos · LATAM · Ubicación desconocida')).toBeVisible()
})

test('failure preserves the last result and can be retried', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.job-card')).toHaveCount(4)
  await page.route('**/api/jobs?role=backend-intern*', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  )
  await page.getByLabel('Puesto').selectOption('backend-intern')
  await page.getByRole('button', { name: 'Ver tecnologías' }).click()
  await expect(page.getByRole('alert')).toContainText('Se muestra el resultado anterior')
  await expect(page.locator('#results-title')).toHaveText('Data Intern')
  await page.unroute('**/api/jobs?role=backend-intern*')
  await page.getByRole('button', { name: 'Ver tecnologías' }).click()
  await expect(page.locator('#results-title')).toHaveText('Backend Intern')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('first load failure has an actionable retry and no fabricated results', async ({ page }) => {
  await page.route('**/api/jobs?role=data-intern*', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  )
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('vuelve a intentarlo')
  await expect(page.locator('.job-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ver tecnologías' })).toBeEnabled()
})

test('URL restores a shared role and filter selection', async ({ page }) => {
  await page.goto('/?role=qa-intern&region=latam&country=cl&workMode=onsite')
  await expect(page.locator('#results-title')).toHaveText('QA Automation Intern')
  await expect(page.getByLabel('Puesto')).toHaveValue('qa-intern')
  await expect(page.getByLabel('País o cobertura')).toHaveValue('cl')
  await expect(page.getByLabel('Modalidad')).toHaveValue('onsite')
  await expect(page.locator('.job-card')).toHaveCount(1)
})

test('narrow layout and screenshot', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.locator('.job-card')).toHaveCount(4)
  await page.screenshot({ path: `artifacts/growth-${testInfo.project.name}.png`, fullPage: true })
  await page.setViewportSize({ width: 320, height: 720 })
  await page.getByText('Cómo se cuentan las tecnologías', { exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true)
})
