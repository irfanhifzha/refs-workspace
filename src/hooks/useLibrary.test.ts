import { describe, expect, it } from 'vitest'
import type { LibraryEntry, ReadingStatus } from '../lib/storage'
import { isStale, moveEntry } from './useLibrary'

function entry(doi: string, status: ReadingStatus, addedAt = '2026-01-01T00:00:00.000Z'): LibraryEntry {
  return { doi, work: { DOI: doi }, status, note: '', addedAt }
}

describe('moveEntry', () => {
  const queue = [entry('a', 'to-read'), entry('b', 'reading'), entry('c', 'to-read')]

  it('swaps with the next to-read entry, skipping other statuses', () => {
    expect(moveEntry(queue, 'a', 1).map((item) => item.doi)).toEqual(['c', 'b', 'a'])
  })

  it('moves up past non-queue entries', () => {
    expect(moveEntry(queue, 'c', -1).map((item) => item.doi)).toEqual(['c', 'b', 'a'])
  })

  it('does nothing at the boundaries or for unknown DOIs', () => {
    expect(moveEntry(queue, 'a', -1)).toBe(queue)
    expect(moveEntry(queue, 'c', 1)).toBe(queue)
    expect(moveEntry(queue, 'missing', 1)).toBe(queue)
  })
})

describe('isStale', () => {
  it('treats old or invalid timestamps as stale', () => {
    expect(isStale(entry('a', 'to-read'))).toBe(true)
    expect(isStale({ ...entry('a', 'to-read'), addedAt: 'not a date' })).toBe(true)
  })

  it('uses updatedAt when the snapshot was refreshed', () => {
    const fresh = { ...entry('a', 'to-read'), updatedAt: new Date().toISOString() }
    expect(isStale(fresh)).toBe(false)
  })
})
