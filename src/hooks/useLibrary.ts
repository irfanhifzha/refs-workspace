import { useCallback, useEffect, useState } from 'react'
import type { CrossrefWork } from '../lib/crossref'
import type { LibraryEntry, ReadingStatus } from '../lib/storage'
import { loadLibrary, saveLibrary, snapshotWork } from '../lib/storage'

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

  return { entries, add, remove, setStatus, setNote, importEntries, isSaved }
}
