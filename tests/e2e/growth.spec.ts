import { test, expect } from '@playwright/test'

test('demo calculates each role and shows the supporting examples', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('GPath — Growth Path')
  const mark = page.locator('.brand-mark')
  const iconPath = await page.locator('link[rel="icon"]').getAttribute('href')
  await expect(mark).toHaveAttribute('src', iconPath!)
  await expect(mark).toHaveJSProperty('naturalWidth', 40)
  await expect(page.getByText('Datos de ejemplo.')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Data Engineer', exact: true }).first(),
  ).toBeVisible()
  await expect(page.locator('.job-card')).toHaveCount(4)
  await expect(page.getByRole('progressbar', { name: 'Python: 4 de 4 ofertas' })).toHaveAttribute(
    'value',
    '100',
  )
  await page.getByRole('radio', { name: /DevOps/ }).check()
  await page.getByRole('button', { name: 'Ver requisitos' }).click()
  await expect(page.locator('#results-title')).toHaveText('DevOps')
  await expect(page.getByRole('progressbar', { name: 'Linux: 4 de 4 ofertas' })).toHaveAttribute(
    'value',
    '100',
  )
  await page.getByRole('radio', { name: /Backend/ }).check()
  await page.getByRole('button', { name: 'Ver requisitos' }).click()
  await expect(page.locator('#results-title')).toHaveText('Backend')
  await expect(
    page.getByRole('progressbar', { name: 'TypeScript: 2 de 4 ofertas' }),
  ).toHaveAttribute('value', '50')
  await expect(page.locator('.example-only')).toHaveCount(4)
})

test('failure preserves the last result and can be retried', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.job-card')).toHaveCount(4)
  await page.route('**/api/jobs?role=backend', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  )
  await page.getByRole('radio', { name: /Backend/ }).check()
  await page.getByRole('button', { name: 'Ver requisitos' }).click()
  await expect(page.getByRole('alert')).toContainText('Se muestra el resultado anterior')
  await expect(page.locator('#results-title')).toHaveText('Data Engineer')
  await page.unroute('**/api/jobs?role=backend')
  await page.getByRole('button', { name: 'Ver requisitos' }).click()
  await expect(page.locator('#results-title')).toHaveText('Backend')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('first load failure has an actionable retry and no fabricated results', async ({ page }) => {
  await page.route('**/api/jobs?role=data', (route) => route.fulfill({ status: 503, body: '{}' }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Inténtalo de nuevo')
  await expect(page.locator('.job-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ver requisitos' })).toBeEnabled()
})

test('narrow layout and screenshot', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.locator('.job-card')).toHaveCount(4)
  await page.screenshot({ path: `artifacts/growth-${testInfo.project.name}.png`, fullPage: true })
  await page.setViewportSize({ width: 320, height: 720 })
  await page.getByText('Cómo se calcula', { exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true)
})

test('empty results keep the role controls available', async ({ page }) => {
  await page.route('**/api/jobs?role=data', (route) =>
    route.fulfill({
      json: {
        role: 'data',
        label: 'Data Engineer',
        mode: 'demo',
        collectedAt: null,
        total: 0,
        jobs: [],
        skills: [],
      },
    }),
  )
  await page.goto('/')
  await expect(page.getByText('No hay ofertas para este puesto en la muestra.')).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ver requisitos' })).toBeEnabled()
})

test('role selection and submission work with a keyboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.job-card')).toHaveCount(4)
  const data = page.getByRole('radio', { name: /Data Engineer/ })
  await data.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: /Backend/ })).toBeChecked()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Ver requisitos' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#results-title')).toHaveText('Backend')
})
