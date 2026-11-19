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

  const isSaved = useCallback(
    (doi: string) => entries.some((entry) => entry.doi === doi),
    [entries],
  )

  return { entries, add, remove, setStatus, setNote, isSaved }
}
