import { describe, expect, it } from 'vitest'
import type { LibraryEntry } from './storage'
import { parseLibraryJson, serializeLibrary } from './storage'

function entry(doi: string): LibraryEntry {
  return {
    doi,
    work: {
      DOI: doi,
      title: [`Title ${doi}`],
      reference: [{ key: 'ref' }],
    },
    status: 'to-read',
    note: 'a note',
    addedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('library JSON export', () => {
  it('exports an object without a version field', () => {
    const parsed = JSON.parse(serializeLibrary([entry('10.1234/a')]))
    expect(parsed).not.toHaveProperty('version')
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0].doi).toBe('10.1234/a')
    expect(parsed.entries[0].work.reference).toBeUndefined()
  })

  it('parses its own export and still accepts an older versioned file', () => {
    const own = parseLibraryJson(serializeLibrary([entry('10.1234/a')]))
    expect(own[0].note).toBe('a note')

    const legacy = JSON.stringify({
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      entries: [entry('10.1234/b')],
    })
    expect(parseLibraryJson(legacy)[0].doi).toBe('10.1234/b')
  })

  it('accepts a bare array and rejects non-library JSON', () => {
    expect(parseLibraryJson(JSON.stringify([entry('10.1234/c')]))[0].doi).toBe('10.1234/c')
    expect(() => parseLibraryJson('{"hello":"world"}')).toThrow(/does not look like/)
    expect(() => parseLibraryJson('not json')).toThrow(/not valid JSON/)
  })
})
