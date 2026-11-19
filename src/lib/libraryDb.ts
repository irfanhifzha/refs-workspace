import type { LibraryEntry } from './storage'
import {
  LIBRARY_KEY,
  loadLibrary as loadLegacyLibrary,
  normalizeEntry,
  saveLibrary,
} from './storage'

const DB_NAME = 'refs-workspace'
const DB_VERSION = 1
const ENTRIES = 'entries'
const META = 'meta'
const ORDER_KEY = 'order'

type OrderRecord = { key: string; dois: string[] }

let dbPromise: Promise<IDBDatabase | null> | null = null
/** Used only when IndexedDB is unavailable, so the app still works in private modes. */
let fallbackEntries: LibraryEntry[] | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }

    let settled = false
    const done = (db: IDBDatabase | null) => {
      if (settled) return
      settled = true
      resolve(db)
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ENTRIES)) {
        db.createObjectStore(ENTRIES, { keyPath: 'doi' })
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => done(request.result)
    request.onerror = () => done(null)
    request.onblocked = () => done(null)
  })

  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function readEntries(db: IDBDatabase): Promise<LibraryEntry[]> {
  const tx = db.transaction(ENTRIES, 'readonly')
  return requestToPromise(tx.objectStore(ENTRIES).getAll() as IDBRequest<LibraryEntry[]>)
}

async function readOrder(db: IDBDatabase): Promise<string[]> {
  const tx = db.transaction(META, 'readonly')
  const record = await requestToPromise(
    tx.objectStore(META).get(ORDER_KEY) as IDBRequest<OrderRecord | undefined>,
  )
  return record?.dois ?? []
}

function sortByOrder(entries: LibraryEntry[], order: string[]): LibraryEntry[] {
  const rank = new Map(order.map((doi, index) => [doi.toLowerCase(), index]))
  return [...entries].sort((a, b) => {
    const left = rank.get(a.doi.toLowerCase())
    const right = rank.get(b.doi.toLowerCase())
    if (left === undefined && right === undefined) return 0
    if (left === undefined) return 1
    if (right === undefined) return -1
    return left - right
  })
}

async function writeAll(db: IDBDatabase, entries: LibraryEntry[]): Promise<void> {
  const tx = db.transaction([ENTRIES, META], 'readwrite')
  const store = tx.objectStore(ENTRIES)
  store.clear()
  for (const entry of entries) store.put(entry)
  tx.objectStore(META).put({ key: ORDER_KEY, dois: entries.map((entry) => entry.doi) })
  await txDone(tx)
}

async function migrateLegacy(db: IDBDatabase): Promise<void> {
  const existing = await readEntries(db)
  if (existing.length > 0) return

  const legacy = loadLegacyLibrary()
  if (legacy.length === 0) return

  await writeAll(db, legacy)
  try {
    localStorage.removeItem(LIBRARY_KEY)
  } catch {
    // A blocked removal just means the migration runs again next time; writes are idempotent.
  }
}

export async function loadLibraryDb(): Promise<LibraryEntry[]> {
  const db = await openDb()
  if (!db) {
    fallbackEntries = loadLegacyLibrary()
    return fallbackEntries
  }

  await migrateLegacy(db)
  const [rows, order] = await Promise.all([readEntries(db), readOrder(db)])
  return sortByOrder(rows.map(normalizeEntry), order)
}

function updateFallback(update: (entries: LibraryEntry[]) => LibraryEntry[]) {
  const current = fallbackEntries ?? loadLegacyLibrary()
  const next = update(current)
  fallbackEntries = next
  saveLibrary(next)
}

export async function writeLibrary(entries: LibraryEntry[]): Promise<void> {
  const db = await openDb()
  if (!db) {
    fallbackEntries = entries
    saveLibrary(entries)
    return
  }
  await writeAll(db, entries)
}

export async function putEntry(entry: LibraryEntry): Promise<void> {
  const db = await openDb()
  if (!db) {
    updateFallback((entries) => [
      entry,
      ...entries.filter((current) => current.doi.toLowerCase() !== entry.doi.toLowerCase()),
    ])
    return
  }

  const tx = db.transaction(ENTRIES, 'readwrite')
  tx.objectStore(ENTRIES).put(entry)
  await txDone(tx)
}

export async function deleteEntry(doi: string): Promise<void> {
  const db = await openDb()
  if (!db) {
    updateFallback((entries) => entries.filter((entry) => entry.doi !== doi))
    return
  }

  const tx = db.transaction(ENTRIES, 'readwrite')
  tx.objectStore(ENTRIES).delete(doi)
  await txDone(tx)
}

export async function saveOrder(dois: string[]): Promise<void> {
  const db = await openDb()
  if (!db) return

  const tx = db.transaction(META, 'readwrite')
  tx.objectStore(META).put({ key: ORDER_KEY, dois })
  await txDone(tx)
}
