import type { CrossrefAuthor, CrossrefWork } from './crossref'
import { parseYear } from './crossref'
import type { LibraryEntry, ReadingStatus } from './storage'
import { STATUSES } from './storage'

export const SHARE_LIMIT = 40

type SharedEntry = {
  d: string
  t?: string
  a?: Array<{ f?: string; g?: string; n?: string }>
  y?: number
  j?: string
  ty?: string
  s?: ReadingStatus
}

type SharedPayload = { v: 1; e: SharedEntry[] }

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function sharedAuthor(author: CrossrefAuthor): { f?: string; g?: string; n?: string } {
  return { f: author.family, g: author.given, n: author.name }
}

function toWork(entry: SharedEntry): CrossrefWork | null {
  if (!entry.d) return null

  const work: CrossrefWork = { DOI: entry.d }
  if (entry.t) work.title = [entry.t]
  if (entry.j) work['container-title'] = [entry.j]
  if (entry.ty) work.type = entry.ty
  if (typeof entry.y === 'number') work.issued = { 'date-parts': [[entry.y]] }

  const authors = (entry.a ?? [])
    .map((author) => ({
      family: author.f,
      given: author.g,
      name: author.n,
    }))
    .filter((author) => author.family || author.name)
  if (authors.length > 0) work.author = authors

  return work
}

/** Notes, added dates, and full reference lists stay out of shared links. */
export function encodeLibraryLink(entries: LibraryEntry[]): string | null {
  if (entries.length === 0) return null

  const payload: SharedPayload = {
    v: 1,
    e: entries.slice(0, SHARE_LIMIT).map((entry) => {
      const year = parseYear(entry.work)
      return {
        d: entry.doi,
        t: entry.work.title?.[0],
        a: (entry.work.author ?? []).slice(0, 3).map(sharedAuthor),
        y: year ? Number(year) : undefined,
        j: entry.work['container-title']?.[0],
        ty: entry.work.type,
        s: entry.status,
      }
    }),
  }

  return toBase64Url(JSON.stringify(payload))
}

export function decodeLibraryHash(hash: string): LibraryEntry[] | null {
  if (!hash.startsWith('#library=')) return null

  try {
    const payload = JSON.parse(fromBase64Url(hash.slice('#library='.length))) as SharedPayload
    if (payload.v !== 1 || !Array.isArray(payload.e)) return null

    const entries: LibraryEntry[] = []
    for (const shared of payload.e) {
      const work = toWork(shared)
      if (!work) continue
      entries.push({
        doi: shared.d,
        work,
        status: STATUSES.includes(shared.s as ReadingStatus)
          ? (shared.s as ReadingStatus)
          : 'to-read',
        note: '',
        addedAt: new Date().toISOString(),
      })
    }

    return entries.length > 0 ? entries.slice(0, SHARE_LIMIT) : null
  } catch {
    return null
  }
}

export function shareLibraryUrl(entries: LibraryEntry[]): string | null {
  const token = encodeLibraryLink(entries)
  return token ? `${window.location.origin}/library#library=${token}` : null
}
