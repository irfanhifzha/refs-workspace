import type { CrossrefWork } from './crossref'

const LIBRARY_KEY = 'refs-workspace:library:v1'
const HISTORY_KEY = 'refs-workspace:search-history:v1'
const HISTORY_LIMIT = 10
export const LIBRARY_FILE_VERSION = 1

export const STATUSES = ['to-read', 'reading', 'done'] as const

export type ReadingStatus = (typeof STATUSES)[number]

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  'to-read': 'To read',
  reading: 'Reading',
  done: 'Done',
}

export type LibraryEntry = {
  doi: string
  work: CrossrefWork
  status: ReadingStatus
  note: string
  addedAt: string
}

export type LibraryFile = {
  version: number
  exportedAt: string
  entries: LibraryEntry[]
}

function isStatus(value: unknown): value is ReadingStatus {
  return STATUSES.includes(value as ReadingStatus)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isEntry(value: unknown): value is LibraryEntry {
  if (!isRecord(value)) return false
  const entry = value as Partial<LibraryEntry>
  return (
    typeof entry.doi === 'string' &&
    entry.doi.trim().length > 0 &&
    isStatus(entry.status) &&
    isRecord(entry.work) &&
    typeof entry.work.DOI === 'string'
  )
}

/** Normalize an untrusted stored/imported entry and keep snapshots reference-free. */
function normalizeEntry(entry: LibraryEntry): LibraryEntry {
  return {
    doi: entry.doi,
    work: snapshotWork(entry.work),
    status: entry.status,
    note: typeof entry.note === 'string' ? entry.note : '',
    addedAt:
      typeof entry.addedAt === 'string' && entry.addedAt
        ? entry.addedAt
        : new Date().toISOString(),
  }
}

export function loadLibrary(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Older snapshots may still contain reference lists; normalize strips them.
    return parsed.filter(isEntry).map(normalizeEntry)
  } catch {
    return []
  }
}

export function saveLibrary(entries: LibraryEntry[]) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries))
  } catch {
    // Storage full or unavailable (private mode). The in-memory library still works.
  }
}

/** Keep library snapshots small: references are re-fetched on the detail screen. */
export function snapshotWork(work: CrossrefWork): CrossrefWork {
  const snapshot = { ...work }
  delete snapshot.reference
  return snapshot
}

export function serializeLibrary(entries: LibraryEntry[]): string {
  const file: LibraryFile = {
    version: LIBRARY_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    entries: entries.map(normalizeEntry),
  }
  return JSON.stringify(file, null, 2)
}

/** Accept both the versioned export format and a bare array of entries. */
export function parseLibraryJson(text: string): LibraryEntry[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  const rawEntries = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.entries)
      ? parsed.entries
      : null

  if (!rawEntries) {
    throw new Error('That file does not look like a Refs Workspace library export.')
  }

  const entries = rawEntries.filter(isEntry).map(normalizeEntry)
  if (entries.length === 0) {
    throw new Error('No valid library entries were found in that file.')
  }
  return entries
}

export function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length >= 3)
      .slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

export function saveSearchHistory(queries: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(queries.slice(0, HISTORY_LIMIT)))
  } catch {
    // Storage full or unavailable; history is a convenience, not required data.
  }
}

export function rememberSearch(queries: string[], query: string): string[] {
  const value = query.trim()
  if (value.length < 3) return queries
  const next = [
    value,
    ...queries.filter((item) => item.toLowerCase() !== value.toLowerCase()),
  ]
  return next.slice(0, HISTORY_LIMIT)
}
