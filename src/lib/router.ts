export type Route =
  | { name: 'search'; query: string }
  | { name: 'library' }
  | { name: 'paper'; doi: string }

type HistoryState = { refsDepth?: number }

const DEPTH_KEY = 'refsDepth'

function historyDepth(): number {
  const state = window.history.state as HistoryState | null
  return typeof state?.[DEPTH_KEY] === 'number' ? state[DEPTH_KEY] : 0
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
    return { name: 'search', query: '' }
  }

  return { name: 'search', query: (params.get('q') ?? '').trim() }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'library':
      return '/library'
    case 'paper':
      return `/paper?doi=${encodeURIComponent(route.doi)}`
    case 'search':
      return route.query ? `/?q=${encodeURIComponent(route.query)}` : '/'
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
