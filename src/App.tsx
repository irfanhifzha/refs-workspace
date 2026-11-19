import { useCallback, useEffect, useState } from 'react'
import { DevGallery } from './components/DevGallery'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LibraryView } from './components/LibraryView'
import { SearchView } from './components/SearchView'
import { WorkDetail } from './components/WorkDetail'
import { useCrossrefSearch } from './hooks/useCrossrefSearch'
import { useLibrary } from './hooks/useLibrary'
import { useRoute } from './hooks/useRoute'
import type { SearchFilters } from './lib/crossref'
import { parseDoiInput } from './lib/crossref'
import { goBack, initializeRouter, navigate } from './lib/router'
import type { LibraryEntry } from './lib/storage'
import { loadSearchHistory, rememberSearch, saveSearchHistory } from './lib/storage'
import { decodeLibraryHash } from './lib/share'
import type { Theme } from './lib/theme'
import { applyTheme, loadTheme, saveTheme, THEME_LABELS, THEMES } from './lib/theme'
import './App.css'

function App() {
  const route = useRoute()
  const searchQuery = route.name === 'search' ? route.query : ''
  const search = useCrossrefSearch(searchQuery, {
    from: route.name === 'search' ? route.from : undefined,
    to: route.name === 'search' ? route.to : undefined,
    type: route.name === 'search' ? route.type : undefined,
    abstract: route.name === 'search' ? route.abstract : undefined,
    references: route.name === 'search' ? route.references : undefined,
    fullText: route.name === 'search' ? route.fullText : undefined,
    sort: route.name === 'search' ? route.sort : 'relevance',
  })
  const library = useLibrary()
  const [history, setHistory] = useState(loadSearchHistory)
  const [shared, setShared] = useState<LibraryEntry[] | null>(() =>
    decodeLibraryHash(window.location.hash),
  )
  const [theme, setTheme] = useState<Theme>(loadTheme)

  useEffect(() => {
    initializeRouter()
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // A shared link lands on the library so its reading list is visible.
  useEffect(() => {
    if (shared) navigate({ name: 'library' }, { replace: true })
    // Shared links are read once at startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    saveSearchHistory(history)
  }, [history])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [route])

  const openPaper = useCallback((doi: string) => {
    navigate({ name: 'paper', doi })
  }, [])

  const back = useCallback(() => {
    goBack({ name: 'search', query: '', sort: 'relevance' })
  }, [])

  const openTab = useCallback((tab: 'search' | 'library') => {
    navigate(
      tab === 'search' ? { name: 'search', query: '', sort: 'relevance' } : { name: 'library' },
    )
  }, [])

  const submitSearch = useCallback(
    (value: string) => {
      const query = value.trim()
      // A DOI, doi.org URL, or Crossref JSON goes straight to the detail view.
      const doi = parseDoiInput(query)
      if (doi) {
        navigate({ name: 'paper', doi })
        return
      }
      setHistory((current) => rememberSearch(current, query))
      if (route.name === 'search' && route.query === query) return
      // Refining a search should not fill the back button with old queries.
      navigate(
        {
          name: 'search',
          query,
          from: route.name === 'search' ? route.from : undefined,
          to: route.name === 'search' ? route.to : undefined,
          type: route.name === 'search' ? route.type : undefined,
          abstract: route.name === 'search' ? route.abstract : undefined,
          references: route.name === 'search' ? route.references : undefined,
          fullText: route.name === 'search' ? route.fullText : undefined,
          sort: route.name === 'search' ? route.sort : 'relevance',
        },
        { replace: route.name === 'search' },
      )
    },
    [route],
  )

  const updateFilters = useCallback(
    (filters: SearchFilters) => {
      navigate(
        {
          name: 'search',
          query: route.name === 'search' ? route.query : '',
          ...filters,
        },
        { replace: true },
      )
    },
    [route],
  )

  const clearHistory = useCallback(() => setHistory([]), [])

  const clearShared = useCallback(() => {
    setShared(null)
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    )
  }, [])

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="app-header">
        <button type="button" className="brand" onClick={() => openTab('search')}>
          Refs Workspace
        </button>

        <div className="header-tools">
          <label className="theme-control">
            <span className="visually-hidden">Theme</span>
            <select
              className="theme-select"
              value={theme}
              onChange={(event) => {
                const next = event.target.value as Theme
                setTheme(next)
                saveTheme(next)
              }}
            >
              {THEMES.map((option) => (
                <option key={option} value={option}>
                  {THEME_LABELS[option]}
                </option>
              ))}
            </select>
          </label>

          <nav className="nav" aria-label="Main">
            <button
              type="button"
              aria-current={route.name === 'search' ? 'page' : undefined}
              onClick={() => openTab('search')}
            >
              Search
            </button>
            <button
              type="button"
              aria-current={route.name === 'library' ? 'page' : undefined}
              onClick={() => openTab('library')}
            >
              Library
              {library.ready && library.entries.length > 0 && (
                <span className="count">{library.entries.length}</span>
              )}
            </button>
          </nav>
        </div>
      </header>

      <main id="main" className="app-main" tabIndex={-1}>
        <ErrorBoundary>
          {route.name === 'search' && (
            <SearchView
              key={searchQuery}
              query={searchQuery}
              filters={{
                from: route.from,
                to: route.to,
                type: route.type,
                abstract: route.abstract,
                references: route.references,
                fullText: route.fullText,
                sort: route.sort,
              }}
              search={search}
              history={history}
              onSubmit={submitSearch}
              onFiltersChange={updateFilters}
              onClearHistory={clearHistory}
              onOpen={openPaper}
              isSaved={library.isSaved}
            />
          )}

          {route.name === 'library' && (
            <LibraryView
              entries={library.entries}
              ready={library.ready}
              shared={shared}
              onSharedDone={clearShared}
              onOpen={openPaper}
              onRemove={library.remove}
              onStatus={library.setStatus}
              onNote={library.setNote}
              onMove={library.move}
              onRefresh={library.refreshStale}
              onImport={library.importEntries}
            />
          )}

          {route.name === 'dev' && <DevGallery />}

          {route.name === 'paper' && (
            <WorkDetail
              key={route.doi}
              doi={route.doi}
              onBack={back}
              onOpenDoi={openPaper}
              saved={library.isSaved(route.doi)}
              isSaved={library.isSaved}
              onSave={library.add}
            />
          )}
        </ErrorBoundary>
      </main>

      {import.meta.env.DEV && (
        <footer className="app-footer">
          <a href="/dev">Component gallery</a>
        </footer>
      )}
    </div>
  )
}

export default App
