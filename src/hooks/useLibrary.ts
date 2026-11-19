import { useCallback, useEffect, useRef, useState } from 'react'
import type { CrossrefWork } from '../lib/crossref'
import { getWork } from '../lib/crossref'
import type { LibraryEntry, ReadingStatus } from '../lib/storage'
import { snapshotWork } from '../lib/storage'
import {
  deleteEntry,
  loadLibraryDb,
  putEntry,
  saveOrder,
  writeLibrary,
} from '../lib/libraryDb'
import { recordError } from '../lib/telemetry'

export const STALE_DAYS = 30

export function isStale(entry: LibraryEntry, days = STALE_DAYS): boolean {
  const stamp = entry.updatedAt ?? entry.addedAt
  const time = Date.parse(stamp)
  return !Number.isFinite(time) || time < Date.now() - days * 86_400_000
}

/** Swap an entry with its next `to-read` neighbour; array order is the queue order. */
export function moveEntry(
  entries: LibraryEntry[],
  doi: string,
  direction: -1 | 1,
): LibraryEntry[] {
  const from = entries.findIndex((entry) => entry.doi === doi)
  if (from === -1) return entries

  let to = from + direction
  while (to >= 0 && to < entries.length && entries[to].status !== 'to-read') {
    to += direction
  }
  if (to < 0 || to >= entries.length) return entries

  const next = [...entries]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

export function useLibrary() {
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [ready, setReady] = useState(false)
  const entriesRef = useRef<LibraryEntry[]>([])

  const commit = useCallback((next: LibraryEntry[]) => {
    entriesRef.current = next
    setEntries(next)
  }, [])

  const persist = useCallback((work: Promise<void>, detail: string) => {
    work.catch((error: unknown) => recordError(error, { kind: 'manual', detail }))
  }, [])

  useEffect(() => {
    let cancelled = false

    loadLibraryDb()
      .then((loaded) => {
        if (cancelled) return
        entriesRef.current = loaded
        setEntries(loaded)
        setReady(true)
      })
      .catch((error: unknown) => {
        recordError(error, { kind: 'manual', detail: 'Loading the library' })
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const add = useCallback(
    (work: CrossrefWork) => {
      if (entriesRef.current.some((entry) => entry.doi === work.DOI)) return

      const entry: LibraryEntry = {
        doi: work.DOI,
        work: snapshotWork(work),
        status: 'to-read',
        note: '',
        addedAt: new Date().toISOString(),
      }
      const next = [entry, ...entriesRef.current]
      commit(next)
      persist(putEntry(entry), 'Saving a paper')
      persist(
        saveOrder(next.map((item) => item.doi)),
        'Saving the reading order',
      )
    },
    [commit, persist],
  )

  const remove = useCallback(
    (doi: string) => {
      const next = entriesRef.current.filter((entry) => entry.doi !== doi)
      if (next.length === entriesRef.current.length) return

      commit(next)
      persist(deleteEntry(doi), 'Removing a paper')
      persist(
        saveOrder(next.map((item) => item.doi)),
        'Saving the reading order',
      )
    },
    [commit, persist],
  )

  const setStatus = useCallback(
    (doi: string, status: ReadingStatus) => {
      const current = entriesRef.current.find((entry) => entry.doi === doi)
      if (!current) return

      const updated: LibraryEntry = { ...current, status }
      commit(entriesRef.current.map((entry) => (entry.doi === doi ? updated : entry)))
      persist(putEntry(updated), 'Saving reading status')
    },
    [commit, persist],
  )

  const setNote = useCallback(
    (doi: string, note: string) => {
      const current = entriesRef.current.find((entry) => entry.doi === doi)
      if (!current) return

      const updated: LibraryEntry = { ...current, note }
      commit(entriesRef.current.map((entry) => (entry.doi === doi ? updated : entry)))
      persist(putEntry(updated), 'Saving a note')
    },
    [commit, persist],
  )

  const move = useCallback(
    (doi: string, direction: -1 | 1) => {
      const next = moveEntry(entriesRef.current, doi, direction)
      if (next === entriesRef.current) return

      commit(next)
      persist(writeLibrary(next), 'Saving the reading order')
    },
    [commit, persist],
  )

  const refreshStale = useCallback(
    async (days = STALE_DAYS) => {
      const stale = entriesRef.current.filter((entry) => isStale(entry, days))
      let refreshed = 0
      let failed = 0

      for (const entry of stale) {
        try {
          const work = await getWork(entry.doi, undefined, { force: true })
          const updated: LibraryEntry = {
            ...entry,
            work: snapshotWork(work),
            updatedAt: new Date().toISOString(),
          }
          commit(
            entriesRef.current.map((current) =>
              current.doi === entry.doi ? updated : current,
            ),
          )
          persist(putEntry(updated), 'Refreshing metadata')
          refreshed += 1
        } catch {
          failed += 1
        }
      }

      return { refreshed, failed, total: stale.length }
    },
    [commit, persist],
  )

  const importEntries = useCallback(
    (incoming: LibraryEntry[]) => {
      const known = new Set(entriesRef.current.map((entry) => entry.doi.toLowerCase()))
      const fresh: LibraryEntry[] = []
      for (const entry of incoming) {
        const key = entry.doi.toLowerCase()
        if (known.has(key)) continue
        known.add(key)
        fresh.push(entry)
      }

      if (fresh.length > 0) {
        const next = [...entriesRef.current, ...fresh]
        commit(next)
        persist(writeLibrary(next), 'Importing the library')
      }

      return { added: fresh.length, skipped: incoming.length - fresh.length }
    },
    [commit, persist],
  )

  const isSaved = useCallback(
    (doi: string) => entries.some((entry) => entry.doi === doi),
    [entries],
  )

  return {
    entries,
    ready,
    add,
    remove,
    setStatus,
    setNote,
    move,
    refreshStale,
    importEntries,
    isSaved,
  }
}
