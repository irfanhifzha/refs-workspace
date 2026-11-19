import { useState } from 'react'
import type { CrossrefSearch } from '../hooks/useCrossrefSearch'
import { SearchBar } from './SearchBar'
import { WorkCard } from './WorkCard'

type Props = {
  query: string
  search: CrossrefSearch
  onSubmit: (value: string) => void
  onOpen: (doi: string) => void
  isSaved: (doi: string) => boolean
}

const MIN_QUERY_LENGTH = 3

export function SearchView({ query, search, onSubmit, onOpen, isSaved }: Props) {
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
      <SearchBar value={draft} onChange={setDraft} onSubmit={onSubmit} />

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
