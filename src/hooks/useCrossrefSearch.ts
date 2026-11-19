import { useCallback, useEffect, useRef, useState } from 'react'
import type { CrossrefWork } from '../lib/crossref'
import { errorMessage, isAbortError, searchWorks } from '../lib/crossref'

const DEBOUNCE_MS = 450
const MIN_QUERY_LENGTH = 3

type SearchState = {
  query: string
  items: CrossrefWork[]
  total: number
  loading: boolean
  loadingMore: boolean
  error: string | null
}

const EMPTY: SearchState = {
  query: '',
  items: [],
  total: 0,
  loading: false,
  loadingMore: false,
  error: null,
}

export type CrossrefSearch = Omit<SearchState, 'query'> & {
  hasMore: boolean
  loadMore: () => void
  retry: () => void
}

export function useCrossrefSearch(query: string): CrossrefSearch {
  const [state, setState] = useState<SearchState>(EMPTY)
  const [attempt, setAttempt] = useState(0)
  const requestId = useRef(0)
  const moreController = useRef<AbortController | null>(null)

  const trimmed = query.trim()

  // Results for a previous query are stale: show the skeleton instead of them.
  const current: SearchState =
    trimmed.length < MIN_QUERY_LENGTH
      ? { ...EMPTY, query: trimmed }
      : state.query === trimmed
        ? state
        : { ...EMPTY, query: trimmed, loading: true }

  useEffect(() => {
    const q = query.trim()
    const id = ++requestId.current

    moreController.current?.abort()
    moreController.current = null

    if (q.length < MIN_QUERY_LENGTH) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchWorks(q, 0, controller.signal)
        .then((page) => {
          if (id !== requestId.current) return
          setState({
            query: q,
            items: page.items,
            total: page.total,
            loading: false,
            loadingMore: false,
            error: null,
          })
        })
        .catch((error: unknown) => {
          if (isAbortError(error) || id !== requestId.current) return
          setState({ ...EMPTY, query: q, error: errorMessage(error) })
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, attempt])

  const itemCount = current.items.length
  const total = current.total
  const loading = current.loading
  const loadingMore = current.loadingMore

  const loadMore = useCallback(() => {
    if (
      trimmed.length < MIN_QUERY_LENGTH ||
      loading ||
      loadingMore ||
      itemCount >= total
    ) {
      return
    }

    const id = requestId.current
    moreController.current?.abort()
    const controller = new AbortController()
    moreController.current = controller

    setState((prev) => (prev.query === trimmed ? { ...prev, loadingMore: true, error: null } : prev))

    searchWorks(trimmed, itemCount, controller.signal)
      .then((page) => {
        if (id !== requestId.current) return
        setState((prev) => {
          if (prev.query !== trimmed) return prev
          const seen = new Set(prev.items.map((work) => work.DOI))
          const merged = [
            ...prev.items,
            ...page.items.filter((work) => !seen.has(work.DOI)),
          ]
          return {
            query: trimmed,
            items: merged,
            total: page.total,
            loading: false,
            loadingMore: false,
            error: null,
          }
        })
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || id !== requestId.current) return
        setState((prev) =>
          prev.query === trimmed
            ? { ...prev, loadingMore: false, error: errorMessage(error) }
            : prev,
        )
      })
  }, [trimmed, itemCount, total, loading, loadingMore])

  const retry = useCallback(() => {
    setState({
      ...EMPTY,
      query: trimmed,
      loading: trimmed.length >= MIN_QUERY_LENGTH,
    })
    setAttempt((value) => value + 1)
  }, [trimmed])

  return {
    items: current.items,
    total: current.total,
    loading: current.loading,
    loadingMore: current.loadingMore,
    error: current.error,
    hasMore: current.items.length > 0 && current.items.length < current.total,
    loadMore,
    retry,
  }
}
