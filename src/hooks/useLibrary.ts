import { useCallback, useEffect, useState } from 'react'
import type { CrossrefWork } from '../lib/crossref'
import { getWork } from '../lib/crossref'
import type { LibraryEntry, ReadingStatus } from '../lib/storage'
import { loadLibrary, saveLibrary, snapshotWork } from '../lib/storage'

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
  const [entries, setEntries] = useState<LibraryEntry[]>(loadLibrary)

  useEffect(() => {
    saveLibrary(entries)
  }, [entries])

  const add = useCallback((work: CrossrefWork) => {
    setEntries((prev) => {
      if (prev.some((entry) => entry.doi === work.DOI)) return prev
      return [
        {
          doi: work.DOI,
          work: snapshotWork(work),
          status: 'to-read',
          note: '',
          addedAt: new Date().toISOString(),
        },
        ...prev,
      ]
    })
  }, [])

  const remove = useCallback((doi: string) => {
    setEntries((prev) => prev.filter((entry) => entry.doi !== doi))
  }, [])

  const setStatus = useCallback((doi: string, status: ReadingStatus) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.doi === doi ? { ...entry, status } : entry)),
    )
  }, [])

  const setNote = useCallback((doi: string, note: string) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.doi === doi ? { ...entry, note } : entry)),
    )
  }, [])

  /** Move an entry past its next `to-read` neighbour; the array order is the queue order. */
  const move = useCallback((doi: string, direction: -1 | 1) => {
    setEntries((prev) => moveEntry(prev, doi, direction))
  }, [])

  const refreshStale = useCallback(
    async (days = STALE_DAYS) => {
      const stale = entries.filter((entry) => isStale(entry, days))
      let refreshed = 0
      let failed = 0

      for (const entry of stale) {
        try {
          const work = await getWork(entry.doi, undefined, { force: true })
          const updatedAt = new Date().toISOString()
          setEntries((prev) =>
            prev.map((current) =>
              current.doi === entry.doi
                ? { ...current, work: snapshotWork(work), updatedAt }
                : current,
            ),
          )
          refreshed += 1
        } catch {
          failed += 1
        }
      }

      return { refreshed, failed, total: stale.length }
    },
    [entries],
  )

  const importEntries = useCallback(
    (incoming: LibraryEntry[]) => {
      const known = new Set(entries.map((entry) => entry.doi.toLowerCase()))
      const fresh: LibraryEntry[] = []
      for (const entry of incoming) {
        const key = entry.doi.toLowerCase()
        if (known.has(key)) continue
        known.add(key)
        fresh.push(entry)
      }

      if (fresh.length > 0) {
        setEntries((prev) => {
          const existing = new Set(prev.map((entry) => entry.doi.toLowerCase()))
          return [
            ...prev,
            ...fresh.filter((entry) => !existing.has(entry.doi.toLowerCase())),
          ]
        })
      }

      return { added: fresh.length, skipped: incoming.length - fresh.length }
    },
    [entries],
  )

  const isSaved = useCallback(
    (doi: string) => entries.some((entry) => entry.doi === doi),
    [entries],
  )

  return {
    entries,
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
