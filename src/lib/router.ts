import type { SearchSort, SearchType } from './crossref'
import { SEARCH_SORTS, SEARCH_TYPES } from './crossref'

export type Route =
  | {
      name: 'search'
      query: string
      from?: string
      to?: string
      type?: SearchType
      sort: SearchSort
    }
  | { name: 'library' }
  | { name: 'paper'; doi: string }

type HistoryState = { refsDepth?: number }

const DEPTH_KEY = 'refsDepth'

function historyDepth(): number {
  const state = window.history.state as HistoryState | null
  return typeof state?.[DEPTH_KEY] === 'number' ? state[DEPTH_KEY] : 0
}

function readYear(raw: string | null): string | undefined {
  const value = (raw ?? '').trim()
  return /^\d{4}$/.test(value) ? value : undefined
}

function readType(raw: string | null): SearchType | undefined {
  const value = (raw ?? '').trim()
  return SEARCH_TYPES.includes(value as SearchType) ? (value as SearchType) : undefined
}

function readSort(raw: string | null): SearchSort {
  const value = (raw ?? '').trim()
  return SEARCH_SORTS.includes(value as SearchSort) ? (value as SearchSort) : 'relevance'
}

/** Ensure the current entry has our depth marker so in-app back is detectable. */
export function initializeRouter() {
  if (window.history.state === null) {
    window.history.replaceState({ [DEPTH_KEY]: 0 }, '')
  }
}

export function readRoute(
  pathname = window.location.pathname,
  search = window.location.search,
): Route {
  const params = new URLSearchParams(search)
  const path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/library') return { name: 'library' }

  if (path === '/paper') {
    const doi = (params.get('doi') ?? '').trim()
    if (doi) return { name: 'paper', doi }
    return { name: 'search', query: '', sort: 'relevance' }
  }

  return {
    name: 'search',
    query: (params.get('q') ?? '').trim(),
    from: readYear(params.get('from')),
    to: readYear(params.get('to')),
    type: readType(params.get('type')),
    sort: readSort(params.get('sort')),
  }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'library':
      return '/library'
    case 'paper':
      return `/paper?doi=${encodeURIComponent(route.doi)}`
    case 'search': {
      const params = new URLSearchParams()
      if (route.query) params.set('q', route.query)
      if (route.from) params.set('from', route.from)
      if (route.to) params.set('to', route.to)
      if (route.type) params.set('type', route.type)
      if (route.sort !== 'relevance') params.set('sort', route.sort)
      const search = params.toString()
      return search ? `/?${search}` : '/'
    }
  }
}

function notify() {
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function navigate(route: Route, options: { replace?: boolean } = {}) {
  const href = routeHref(route)
  if (options.replace) {
    window.history.replaceState({ [DEPTH_KEY]: historyDepth() }, '', href)
  } else {
    window.history.pushState({ [DEPTH_KEY]: historyDepth() + 1 }, '', href)
  }
  notify()
}

/** Go back in the app if possible; otherwise replace the current entry. */
export function goBack(fallback: Route) {
  if (historyDepth() > 0) {
    window.history.back()
    return
  }
  navigate(fallback, { replace: true })
}
