import { useCallback, useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LibraryView } from './components/LibraryView'
import { SearchView } from './components/SearchView'
import { WorkDetail } from './components/WorkDetail'
import { useCrossrefSearch } from './hooks/useCrossrefSearch'
import { useLibrary } from './hooks/useLibrary'
import './App.css'

type View =
  | { name: 'search' }
  | { name: 'library' }
  | { name: 'paper'; doi: string }

function App() {
  const [stack, setStack] = useState<View[]>([{ name: 'search' }])
  const [query, setQuery] = useState('')
  const search = useCrossrefSearch(query)
  const library = useLibrary()

  const view: View = stack[stack.length - 1] ?? { name: 'search' }

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [stack])

  const openPaper = useCallback((doi: string) => {
    setStack((current) => [...current, { name: 'paper', doi }])
  }, [])

  const back = useCallback(() => {
    setStack((current) =>
      current.length > 1 ? current.slice(0, -1) : [{ name: 'search' }],
    )
  }, [])

  const openTab = useCallback((tab: 'search' | 'library') => {
    setStack([tab === 'search' ? { name: 'search' } : { name: 'library' }])
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <button type="button" className="brand" onClick={() => openTab('search')}>
          Refs Workspace
        </button>

        <nav className="nav" aria-label="Main">
          <button
            type="button"
            aria-current={view.name === 'search' ? 'page' : undefined}
            onClick={() => openTab('search')}
          >
            Search
          </button>
          <button
            type="button"
            aria-current={view.name === 'library' ? 'page' : undefined}
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
          {view.name === 'search' && (
            <SearchView
              query={query}
              search={search}
              onQueryChange={setQuery}
              onOpen={openPaper}
              isSaved={library.isSaved}
            />
          )}

          {view.name === 'library' && (
            <LibraryView
              entries={library.entries}
              onOpen={openPaper}
              onRemove={library.remove}
              onStatus={library.setStatus}
              onNote={library.setNote}
            />
          )}

          {view.name === 'paper' && (
            <WorkDetail
              key={view.doi}
              doi={view.doi}
              onBack={back}
              onOpenDoi={openPaper}
              saved={library.isSaved(view.doi)}
              onSave={library.add}
            />
          )}
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default App
