import { useState } from 'react'
import type { CrossrefSearch } from '../hooks/useCrossrefSearch'
import type { SearchFilters } from '../lib/crossref'
import { SearchBar } from './SearchBar'
import { SearchFilterBar } from './SearchFilterBar'
import { WorkCard } from './WorkCard'

type Props = {
  query: string
  filters: SearchFilters
  search: CrossrefSearch
  history: string[]
  onSubmit: (value: string) => void
  onFiltersChange: (filters: SearchFilters) => void
  onClearHistory: () => void
  onOpen: (doi: string) => void
  isSaved: (doi: string) => boolean
}

const MIN_QUERY_LENGTH = 3

export function SearchView({
  query,
  filters,
  search,
  history,
  onSubmit,
  onFiltersChange,
  onClearHistory,
  onOpen,
  isSaved,
}: Props) {
  // Remounted by App when the URL query changes, so this tracks the submitted query.
  const [draft, setDraft] = useState(query)
  const submitted = search.query.trim()
  const tooShort = submitted.length < MIN_QUERY_LENGTH
  const showIntro = tooShort && !search.loading && !search.error
  const showResults = !tooShort && !search.loading && !search.error
  const draftLength = draft.trim().length
  const showMinHint =
    !search.loading && !search.error && draftLength > 0 && draftLength < MIN_QUERY_LENGTH

  return (
    <div>
      <SearchBar value={draft} history={history} onChange={setDraft} onSubmit={onSubmit} />

      <SearchFilterBar
        key={`${filters.from ?? ''}|${filters.to ?? ''}|${filters.type ?? ''}|${filters.sort}`}
        filters={filters}
        onChange={onFiltersChange}
      />

      {showIntro && history.length > 0 && (
        <section className="history" aria-label="Recent searches">
          <div className="history-head">
            <span className="history-title">Recent searches · ↑↓ recall</span>
            <button type="button" className="btn btn-ghost" onClick={onClearHistory}>
              Clear
            </button>
          </div>
          <div className="history-list">
            {history.map((item) => (
              <button
                key={item}
                type="button"
                className="history-item"
                onClick={() => onSubmit(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      {showMinHint && <p className="hint">Type at least {MIN_QUERY_LENGTH} characters to search.</p>}

      {search.loading && (
        <div className="skeleton" aria-busy="true" aria-label="Searching Crossref">
          {[0, 1, 2].map((row) => (
            <div className="skeleton-row" key={row}>
              <div className="skeleton-line w-80" />
              <div className="skeleton-line w-50" />
            </div>
          ))}
        </div>
      )}

      {!search.loading && search.error && (
        <div className="state error" role="alert">
          <p>{search.error}</p>
          <button type="button" className="btn" onClick={search.retry}>
            Try again
          </button>
        </div>
      )}

      {showIntro && (
        <p className="state">
          Search Crossref for a paper by title, author, or journal. Press Enter to search.
        </p>
      )}

      {showResults && (
        <>
          <p className="result-count" aria-live="polite">
            {search.loadingMore
              ? 'Loading more…'
              : `${search.total.toLocaleString()} result${search.total === 1 ? '' : 's'}`}
          </p>

          {search.items.length === 0 ? (
            <p className="state">No papers matched. Try a different title, author, or journal.</p>
          ) : (
            <ul className="work-list">
              {search.items.map((work) => (
                <WorkCard
                  key={work.DOI}
                  work={work}
                  saved={isSaved(work.DOI)}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          )}

          {search.hasMore && (
            <div className="load-more">
              <button
                type="button"
                className="btn"
                onClick={search.loadMore}
                disabled={search.loadingMore}
              >
                {search.loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
