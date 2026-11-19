import { describe, expect, it } from 'vitest'
import type { LibraryEntry } from './storage'
import { decodeLibraryHash, encodeLibraryLink, SHARE_LIMIT } from './share'

function entry(doi: string, status: LibraryEntry['status'] = 'to-read'): LibraryEntry {
  return {
    doi,
    status,
    note: 'private note',
    addedAt: '2026-01-01T00:00:00.000Z',
    work: {
      DOI: doi,
      title: [`Title ${doi}`],
      author: [{ given: 'Richard P.', family: 'Feynman' }],
      'container-title': ['Journal of Tests'],
      issued: { 'date-parts': [[1965]] },
      type: 'journal-article',
    },
  }
}

describe('share links', () => {
  it('round-trips the reading list without notes', () => {
    const token = encodeLibraryLink([entry('10.1234/a'), entry('10.1234/b', 'reading')])
    expect(token).toBeTruthy()

    const decoded = decodeLibraryHash(`#library=${token}`)
    expect(decoded).toHaveLength(2)
    expect(decoded?.[0].doi).toBe('10.1234/a')
    expect(decoded?.[0].note).toBe('')
    expect(decoded?.[0].work.title).toEqual(['Title 10.1234/a'])
    expect(decoded?.[0].work.author?.[0].family).toBe('Feynman')
    expect(decoded?.[1].status).toBe('reading')
  })

  it('ignores other hashes and malformed tokens', () => {
    expect(decodeLibraryHash('')).toBeNull()
    expect(decodeLibraryHash('#something-else')).toBeNull()
    expect(decodeLibraryHash('#library=not-a-token')).toBeNull()
  })

  it('caps a shared list at the limit', () => {
    const many = Array.from({ length: SHARE_LIMIT + 5 }, (_, index) => entry(`10.1234/${index}`))
    const decoded = decodeLibraryHash(`#library=${encodeLibraryLink(many)}`)
    expect(decoded).toHaveLength(SHARE_LIMIT)
  })
})
