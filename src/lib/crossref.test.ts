import { describe, expect, it } from 'vitest'
import { normalizeWork, parseDoiInput, parseYear } from './crossref'

describe('parseDoiInput', () => {
  it('reads a bare DOI', () => {
    expect(parseDoiInput('10.1038/nphys1170')).toBe('10.1038/nphys1170')
  })

  it('reads a doi.org URL and drops trailing punctuation', () => {
    expect(parseDoiInput('See https://doi.org/10.1038/nphys1170.')).toBe('10.1038/nphys1170')
  })

  it('reads a pasted Crossref detail response', () => {
    const json = JSON.stringify({ status: 'ok', message: { DOI: '10.1234/abc', title: ['X'] } })
    expect(parseDoiInput(json)).toBe('10.1234/abc')
  })

  it('reads a pasted Crossref list response', () => {
    const json = JSON.stringify({
      message: { items: [{ DOI: '10.1234/first' }, { DOI: '10.1234/second' }] },
    })
    expect(parseDoiInput(json)).toBe('10.1234/first')
  })

  it('treats ordinary queries as searches', () => {
    expect(parseDoiInput('feynman path integral')).toBeNull()
    expect(parseDoiInput('10.1038')).toBeNull()
    expect(parseDoiInput('')).toBeNull()
  })
})

describe('normalizeWork', () => {
  it('cleans HTML/JATS and drops empty authors', () => {
    const work = normalizeWork({
      DOI: '10.1234/abc',
      title: ['A <i>marked</i> up title'],
      abstract: '<jats:p>Plain <b>abstract</b>.</jats:p>',
      author: [{ given: 'Richard', family: 'Feynman' }, { given: 'Nobody' }],
      subject: ['Physics', ''],
    })

    expect(work.title).toEqual(['A marked up title'])
    expect(work.abstract).toBe('Plain abstract.')
    expect(work.author).toEqual([{ given: 'Richard', family: 'Feynman', name: undefined }])
    expect(work.subject).toEqual(['Physics'])
  })
})

describe('parseYear', () => {
  it('prefers issued, then published', () => {
    expect(parseYear({ DOI: 'x', issued: { 'date-parts': [[1965]] } })).toBe('1965')
    expect(parseYear({ DOI: 'x', published: { 'date-parts': [[2001]] } })).toBe('2001')
  })

  it('returns null when no usable year exists', () => {
    expect(parseYear({ DOI: 'x' })).toBeNull()
    expect(parseYear({ DOI: 'x', issued: { 'date-parts': [[0]] } })).toBeNull()
  })
})
