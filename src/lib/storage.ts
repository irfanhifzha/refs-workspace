import type { CrossrefWork } from './crossref'

const LIBRARY_KEY = 'refs-workspace:library:v1'

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

function isStatus(value: unknown): value is ReadingStatus {
  return STATUSES.includes(value as ReadingStatus)
}

function isEntry(value: unknown): value is LibraryEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<LibraryEntry>
  return (
    typeof entry.doi === 'string' &&
    isStatus(entry.status) &&
    typeof entry.work === 'object' &&
    entry.work !== null &&
    typeof entry.work.DOI === 'string'
  )
}

export function loadLibrary(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry).map((entry) => ({
      ...entry,
      note: typeof entry.note === 'string' ? entry.note : '',
    }))
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
