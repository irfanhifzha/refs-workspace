import { useCallback, useEffect, useRef, useState } from 'react'
import type { CrossrefWork, SearchOptions } from '../lib/crossref'
import { errorMessage, isAbortError, searchWorks } from '../lib/crossref'

const MIN_QUERY_LENGTH = 3

type SearchState = {
  key: string
  query: string
  items: CrossrefWork[]
  total: number
  loading: boolean
  loadingMore: boolean
  error: string | null
}

const EMPTY: SearchState = {
  key: '',
  query: '',
  items: [],
  total: 0,
  loading: false,
  loadingMore: false,
  error: null,
}

function criteriaKey(query: string, options: SearchOptions): string {
  return [
    query,
    options.from ?? '',
    options.to ?? '',
    options.type ?? '',
    options.sort ?? 'relevance',
  ].join('|')
}

export type CrossrefSearch = SearchState & {
  hasMore: boolean
  loadMore: () => void
  retry: () => void
}

export function useCrossrefSearch(query: string, options: SearchOptions = {}): CrossrefSearch {
  const { from, to, type, sort } = options
  const [state, setState] = useState<SearchState>(EMPTY)
  const [attempt, setAttempt] = useState(0)
  const requestId = useRef(0)
  const moreController = useRef<AbortController | null>(null)

  const trimmed = query.trim()
  const key = criteriaKey(trimmed, { from, to, type, sort })

  // Results for a previous query or filter set are stale: show the skeleton instead.
  const current: SearchState =
    trimmed.length < MIN_QUERY_LENGTH
      ? { ...EMPTY, query: trimmed }
      : state.key === key
        ? state
        : { ...EMPTY, key, query: trimmed, loading: true }

  useEffect(() => {
    const q = query.trim()
    const id = ++requestId.current

    moreController.current?.abort()
    moreController.current = null

    if (q.length < MIN_QUERY_LENGTH) return

    const criteria = { from, to, type, sort }
    const criteriaId = criteriaKey(q, criteria)
    const controller = new AbortController()
    searchWorks(q, 0, criteria, controller.signal)
      .then((page) => {
        if (id !== requestId.current) return
        setState({
          key: criteriaId,
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
        setState({ ...EMPTY, key: criteriaId, query: q, error: errorMessage(error) })
      })

    return () => controller.abort()
  }, [query, from, to, type, sort, attempt])

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

    const criteria = { from, to, type, sort }
    const criteriaId = criteriaKey(trimmed, criteria)
    const id = requestId.current
    moreController.current?.abort()
    const controller = new AbortController()
    moreController.current = controller

    setState((prev) =>
      prev.key === criteriaId ? { ...prev, loadingMore: true, error: null } : prev,
    )

    searchWorks(trimmed, itemCount, criteria, controller.signal)
      .then((page) => {
        if (id !== requestId.current) return
        setState((prev) => {
          if (prev.key !== criteriaId) return prev
          const seen = new Set(prev.items.map((work) => work.DOI))
          const merged = [
            ...prev.items,
            ...page.items.filter((work) => !seen.has(work.DOI)),
          ]
          return {
            key: criteriaId,
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
          prev.key === criteriaId
            ? { ...prev, loadingMore: false, error: errorMessage(error) }
            : prev,
        )
      })
  }, [trimmed, from, to, type, sort, itemCount, total, loading, loadingMore])

  const retry = useCallback(() => {
    setState({
      ...EMPTY,
      key: criteriaKey(trimmed, { from, to, type, sort }),
      query: trimmed,
      loading: trimmed.length >= MIN_QUERY_LENGTH,
    })
    setAttempt((value) => value + 1)
  }, [trimmed, from, to, type, sort])

  return {
    key: current.key,
    query: current.query,
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
