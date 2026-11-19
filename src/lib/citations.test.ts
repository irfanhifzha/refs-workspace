import { describe, expect, it } from 'vitest'
import {
  formatApa,
  formatChicago,
  formatHarvard,
  formatIeee,
  formatMla,
  formatVancouver,
  toBibtex,
} from './citations'
import type { CrossrefWork } from './crossref'

const article: CrossrefWork = {
  DOI: '10.1234/abc',
  title: ['A study of things'],
  author: [
    { given: 'Richard P.', family: 'Feynman' },
    { given: 'John A.', family: 'Wheeler' },
  ],
  'container-title': ['Journal of Tests'],
  issued: { 'date-parts': [[1965]] },
  type: 'journal-article',
  volume: '3',
  issue: '2',
  page: '10-20',
}

describe('formatApa', () => {
  it('formats authors, year, title, source, and DOI', () => {
    expect(formatApa(article)).toBe(
      'Feynman, R. P., & Wheeler, J. A. (1965). A study of things. Journal of Tests, 3(2), 10–20. https://doi.org/10.1234/abc',
    )
  })

  it('falls back to n.d. and publisher for books', () => {
    const book: CrossrefWork = {
      DOI: '10.1234/book',
      title: ['A book'],
      publisher: 'Example Press',
      type: 'book',
    }
    expect(formatApa(book)).toBe('(n.d.). A book. Example Press. https://doi.org/10.1234/book')
  })
})

describe('additional citation styles', () => {
  it('formats Chicago with a quoted title and year', () => {
    const citation = formatChicago(article)
    expect(citation).toContain('Feynman, Richard P., and John A. Wheeler.')
    expect(citation).toContain('1965.')
    expect(citation).toContain('“A study of things.”')
    expect(citation).toContain('https://doi.org/10.1234/abc')
  })

  it('formats Harvard with the year in parentheses', () => {
    const citation = formatHarvard(article)
    expect(citation).toContain('(1965)')
    expect(citation).toContain("'A study of things'")
    expect(citation).toContain('Journal of Tests, 3(2), pp. 10–20')
  })

  it('formats IEEE with vol./no./pp. and initials first', () => {
    const citation = formatIeee(article)
    expect(citation).toContain('R. P. Feynman and J. A. Wheeler')
    expect(citation).toContain('vol. 3, no. 2, pp. 10–20')
    expect(citation).toContain('doi: 10.1234/abc')
  })

  it('formats MLA with vol./no. and a DOI URL', () => {
    const citation = formatMla(article)
    expect(citation).toContain('“A study of things.”')
    expect(citation).toContain('vol. 3, no. 2')
    expect(citation).toContain('https://doi.org/10.1234/abc')
  })

  it('formats Vancouver with tight initials and semicolon volume', () => {
    const citation = formatVancouver(article)
    expect(citation).toContain('Feynman RP, Wheeler JA.')
    expect(citation).toContain('1965;3(2):10–20')
    expect(citation).toContain('doi:10.1234/abc')
  })
})

describe('toBibtex', () => {
  it('maps Crossref types and includes only present fields', () => {
    const bib = toBibtex(article)
    expect(bib).toContain('@article{')
    expect(bib).toContain('author = {Feynman, Richard P. and Wheeler, John A.},')
    expect(bib).toContain('journal = {Journal of Tests},')
    expect(bib).toContain('pages = {10--20},')
    expect(bib).toContain('doi = {10.1234/abc},')
  })

  it('escapes braces and backslashes', () => {
    const bib = toBibtex({ DOI: '10.1/x', title: ['Braces {and} \\ slashes'] })
    expect(bib).toContain('title = {Braces \\{and\\} \\textbackslash{} slashes},')
  })
})
