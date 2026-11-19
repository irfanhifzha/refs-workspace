import type { CrossrefSearch } from '../hooks/useCrossrefSearch'
import { SearchBar } from './SearchBar'
import { WorkCard } from './WorkCard'

type Props = {
  query: string
  search: CrossrefSearch
  onQueryChange: (value: string) => void
  onOpen: (doi: string) => void
  isSaved: (doi: string) => boolean
}

const MIN_QUERY_LENGTH = 3

export function SearchView({ query, search, onQueryChange, onOpen, isSaved }: Props) {
  const trimmed = query.trim()
  const showIntro = trimmed.length < MIN_QUERY_LENGTH
  const showResults = !showIntro && !search.loading && !search.error

  return (
    <div>
      <SearchBar value={query} onChange={onQueryChange} />

      {trimmed.length > 0 && showIntro && (
        <p className="hint">Type at least {MIN_QUERY_LENGTH} characters to search.</p>
      )}

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

      {showIntro && !search.loading && !search.error && (
        <p className="state">Search Crossref for a paper by title, author, or journal.</p>
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
