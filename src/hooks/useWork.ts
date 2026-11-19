import { useCallback, useEffect, useState } from 'react'
import type { CrossrefWork } from '../lib/crossref'
import { errorMessage, getCachedWork, getWork, isAbortError } from '../lib/crossref'

type WorkState = {
  doi: string
  work: CrossrefWork | null
  loading: boolean
  error: string | null
}

function initialState(doi: string): WorkState {
  const cached = getCachedWork(doi)
  return cached
    ? { doi, work: cached, loading: false, error: null }
    : { doi, work: null, loading: true, error: null }
}

export function useWork(doi: string) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<WorkState>(() => initialState(doi))

  // If the DOI changes, use the cache immediately while the effect below runs.
  const current = state.doi === doi ? state : initialState(doi)

  useEffect(() => {
    if (getCachedWork(doi)) return

    const controller = new AbortController()
    getWork(doi, controller.signal)
      .then((work) => setState({ doi, work, loading: false, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setState({ doi, work: null, loading: false, error: errorMessage(error) })
      })

    return () => controller.abort()
  }, [doi, attempt])

  const retry = useCallback(() => {
    setState({ doi, work: null, loading: true, error: null })
    setAttempt((value) => value + 1)
  }, [doi])

  return { ...current, retry }
}
