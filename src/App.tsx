import { useCallback, useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LibraryView } from './components/LibraryView'
import { SearchView } from './components/SearchView'
import { WorkDetail } from './components/WorkDetail'
import { useCrossrefSearch } from './hooks/useCrossrefSearch'
import { useLibrary } from './hooks/useLibrary'
import { useRoute } from './hooks/useRoute'
import type { SearchFilters } from './lib/crossref'
import { goBack, initializeRouter, navigate } from './lib/router'
import { loadSearchHistory, rememberSearch, saveSearchHistory } from './lib/storage'
import './App.css'

function App() {
  const route = useRoute()
  const searchQuery = route.name === 'search' ? route.query : ''
  const search = useCrossrefSearch(searchQuery, {
    from: route.name === 'search' ? route.from : undefined,
    to: route.name === 'search' ? route.to : undefined,
    type: route.name === 'search' ? route.type : undefined,
    sort: route.name === 'search' ? route.sort : 'relevance',
  })
  const library = useLibrary()
  const [history, setHistory] = useState(loadSearchHistory)

  useEffect(() => {
    initializeRouter()
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

  return (
    <div className="app">
      <header className="app-header">
        <button type="button" className="brand" onClick={() => openTab('search')}>
          Refs Workspace
        </button>

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
            {library.entries.length > 0 && (
              <span className="count">{library.entries.length}</span>
            )}
          </button>
        </nav>
      </header>

      <main className="app-main">
        <ErrorBoundary>
          {route.name === 'search' && (
            <SearchView
              key={searchQuery}
              query={searchQuery}
              filters={{
                from: route.from,
                to: route.to,
                type: route.type,
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
              onOpen={openPaper}
              onRemove={library.remove}
              onStatus={library.setStatus}
              onNote={library.setNote}
              onImport={library.importEntries}
            />
          )}

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
    </div>
  )
}

export default App
