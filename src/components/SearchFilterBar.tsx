import { useState } from 'react'
import type { SearchFilters, SearchType } from '../lib/crossref'
import { SEARCH_SORTS, SEARCH_TYPES } from '../lib/crossref'

const TYPE_LABELS: Record<SearchType, string> = {
  'journal-article': 'Journal article',
  'book-chapter': 'Book chapter',
  'proceedings-article': 'Proceedings article',
  'posted-content': 'Preprint',
  book: 'Book',
  dataset: 'Dataset',
  report: 'Report',
  dissertation: 'Dissertation',
}

const SORT_LABELS: Record<(typeof SEARCH_SORTS)[number], string> = {
  relevance: 'Most relevant',
  newest: 'Newest first',
  oldest: 'Oldest first',
  cited: 'Most cited',
}

type Props = {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
}

export function SearchFilterBar({ filters, onChange }: Props) {
  const [fromDraft, setFromDraft] = useState(filters.from ?? '')
  const [toDraft, setToDraft] = useState(filters.to ?? '')

  const hasFilters =
    Boolean(filters.from) || Boolean(filters.to) || Boolean(filters.type) || filters.sort !== 'relevance'

  function commitYear(which: 'from' | 'to', raw: string) {
    const value = raw.trim()
    const current = filters[which] ?? ''

    if (value === current) return

    if (/^\d{4}$/.test(value)) {
      onChange({ ...filters, [which]: value })
      return
    }

    if (!value) {
      onChange({ ...filters, [which]: undefined })
      return
    }

    // Invalid or partial year: fall back to the committed value.
    if (which === 'from') setFromDraft(current)
    else setToDraft(current)
  }

  function clear() {
    setFromDraft('')
    setToDraft('')
    onChange({ sort: 'relevance' })
  }

  return (
    <div className="filters" role="group" aria-label="Search filters">
      <input
        className="filter-input year"
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={fromDraft}
        onChange={(event) => setFromDraft(event.target.value)}
        onBlur={() => commitYear('from', fromDraft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        placeholder="From year"
        aria-label="Published from year"
      />
      <input
        className="filter-input year"
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={toDraft}
        onChange={(event) => setToDraft(event.target.value)}
        onBlur={() => commitYear('to', toDraft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        placeholder="To year"
        aria-label="Published to year"
      />

      <select
        className="filter-input"
        value={filters.type ?? ''}
        onChange={(event) =>
          onChange({
            ...filters,
            type: (event.target.value || undefined) as SearchType | undefined,
          })
        }
        aria-label="Publication type"
      >
        <option value="">Any type</option>
        {SEARCH_TYPES.map((type) => (
          <option key={type} value={type}>
            {TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      <select
        className="filter-input"
        value={filters.sort}
        onChange={(event) =>
          onChange({
            ...filters,
            sort: event.target.value as SearchFilters['sort'],
          })
        }
        aria-label="Sort results"
      >
        {SEARCH_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {SORT_LABELS[sort]}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button type="button" className="btn btn-ghost" onClick={clear}>
          Clear filters
        </button>
      )}
    </div>
  )
}
