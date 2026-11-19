import { describe, expect, it } from 'vitest'
import { parseBibtex, parseImportFile, parseRis } from './importers'

describe('parseBibtex', () => {
  const bib = String.raw`
@article{feynman1965,
  title = {A {Nested} Title},
  author = {Feynman, Richard P. and Wheeler, John A.},
  journal = {Journal of Tests},
  year = {1965},
  volume = {3},
  number = {2},
  pages = {10--20},
  doi = {10.1234/abc}
}

@book{nodoi,
  title = {No DOI here}
}
`

  it('maps fields into a library entry', () => {
    const { entries, skipped } = parseBibtex(bib)
    expect(skipped).toBe(1)
    expect(entries).toHaveLength(1)

    const entry = entries[0]
    expect(entry.doi).toBe('10.1234/abc')
    expect(entry.work.title).toEqual(['A Nested Title'])
    expect(entry.work.author).toEqual([
      { family: 'Feynman', given: 'Richard P.' },
      { family: 'Wheeler', given: 'John A.' },
    ])
    expect(entry.work['container-title']).toEqual(['Journal of Tests'])
    expect(entry.work.issued).toEqual({ 'date-parts': [[1965]] })
    expect(entry.work.page).toBe('10-20')
    expect(entry.status).toBe('to-read')
  })
})

describe('parseRis', () => {
  const ris = [
    'TY  - JOUR',
    'TI  - A RIS paper',
    'AU  - Feynman, Richard P.',
    'JO  - Journal of Tests',
    'PY  - 1965',
    'VL  - 3',
    'SP  - 10',
    'EP  - 20',
    'DO  - 10.1234/ris',
    'ER  - ',
  ].join('\n')

  it('reads tags and page ranges', () => {
    const { entries, skipped } = parseRis(ris)
    expect(skipped).toBe(0)
    expect(entries).toHaveLength(1)
    expect(entries[0].doi).toBe('10.1234/ris')
    expect(entries[0].work.title).toEqual(['A RIS paper'])
    expect(entries[0].work.page).toBe('10-20')
    expect(entries[0].work.author?.[0].family).toBe('Feynman')
  })
})

describe('parseImportFile', () => {
  it('still accepts the JSON library export format', () => {
    const json = JSON.stringify({
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        {
          doi: '10.1234/json',
          work: { DOI: '10.1234/json', title: ['A JSON paper'] },
          status: 'reading',
          note: 'note',
          addedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    const { entries } = parseImportFile('library.json', json)
    expect(entries[0].doi).toBe('10.1234/json')
    expect(entries[0].status).toBe('reading')
  })

  it('sniffs BibTeX by content', () => {
    const { entries } = parseImportFile(
      'export.txt',
      '@article{k, title={T}, doi={10.1234/bib}}',
    )
    expect(entries[0].doi).toBe('10.1234/bib')
  })
})
