import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const DOI = '10.1234/test-paper'

const item = {
  DOI,
  title: ['A test paper about path integrals'],
  author: [
    { given: 'Richard P.', family: 'Feynman' },
    { given: 'John A.', family: 'Wheeler' },
  ],
  'container-title': ['Journal of Tests'],
  issued: { 'date-parts': [[1965]] },
  type: 'journal-article',
  subject: ['Physics', 'Quantum mechanics'],
  'is-referenced-by-count': 42,
}

const detail = {
  ...item,
  abstract: '<jats:p>A short <b>abstract</b>.</jats:p>',
  reference: [
    {
      key: 'ref1',
      DOI: '10.1234/referenced',
      'article-title': 'A referenced paper',
      'journal-title': 'Journal of Tests',
      year: '1960',
    },
  ],
}

test.beforeEach(async ({ page }) => {
  await page.route('https://api.crossref.org/**', async (route) => {
    const url = decodeURIComponent(route.request().url())
    if (url.includes(`/works/${DOI}`)) {
      await route.fulfill({ json: { status: 'ok', message: detail } })
      return
    }
    await route.fulfill({
      json: { status: 'ok', message: { 'total-results': 1, items: [item] } },
    })
  })
})

test('search, open, save, reload, and find it in the library', async ({ page }) => {
  await page.goto('/')

  const searchbox = page.getByRole('searchbox')
  await searchbox.fill('feynman path integral')
  await searchbox.press('Enter')

  const resultTitle = page.getByRole('button', { name: 'A test paper about path integrals' })
  await expect(resultTitle).toBeVisible()
  await resultTitle.click()

  await expect(
    page.getByRole('heading', { name: 'A test paper about path integrals' }),
  ).toBeVisible()
  await expect(page.getByText('A short abstract.')).toBeVisible()

  await page.getByRole('button', { name: 'Save to library' }).click()
  await expect(page.getByRole('button', { name: 'In library' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'In library' })).toBeVisible()

  await page.getByRole('button', { name: /Library/ }).click()
  await expect(
    page.getByRole('button', { name: 'A test paper about path integrals' }),
  ).toBeVisible()
})

test('arrow-up recalls a recent search', async ({ page }) => {
  await page.goto('/')

  const searchbox = page.getByRole('searchbox')
  await searchbox.fill('quantum electrodynamics')
  await searchbox.press('Enter')
  await expect(page.getByText('1 result')).toBeVisible()

  await searchbox.fill('different query')
  await searchbox.press('ArrowUp')
  await expect(searchbox).toHaveValue('quantum electrodynamics')
})

test('theme choice persists across reloads', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('combobox', { name: 'Theme' }).selectOption('sepia')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia')
})

test('pasted JSON is previewed, imported, and exported as a download', async ({ page }) => {
  await page.goto('/library')

  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const pasted = {
    exportedAt: '2026-01-01T00:00:00.000Z',
    entries: [
      {
        doi: '10.1234/pasted',
        work: { DOI: '10.1234/pasted', title: ['Pasted paper title'] },
        status: 'reading',
        note: 'imported by paste',
        addedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
  }
  await page.getByLabel('Paste library JSON').fill(JSON.stringify(pasted))
  await page.getByRole('button', { name: 'Review pasted JSON' }).click()

  await expect(page.getByText('Found 1 new paper')).toBeVisible()
  await page.getByRole('button', { name: 'Import 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pasted paper title' })).toBeVisible()

  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download JSON' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('refs-workspace-library.json')

  const path = await download.path()
  const file = JSON.parse(await readFile(path!, 'utf8'))
  expect(file.version).toBeUndefined()
  expect(file.entries[0].doi).toBe('10.1234/pasted')
  expect(file.entries[0].note).toBe('imported by paste')
})

test('the dev gallery renders component states', async ({ page }) => {
  await page.goto('/dev')

  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Result cards' })).toBeVisible()

  await page.getByRole('button', { name: 'Record a sample error' }).click()
  await expect(page.getByText('Sample gallery error')).toBeVisible()
})

test('pasting a DOI opens the paper directly', async ({ page }) => {
  await page.goto('/')

  const searchbox = page.getByRole('searchbox')
  await searchbox.fill(`https://doi.org/${DOI}`)
  await searchbox.press('Enter')

  await expect(
    page.getByRole('heading', { name: 'A test paper about path integrals' }),
  ).toBeVisible()
})
