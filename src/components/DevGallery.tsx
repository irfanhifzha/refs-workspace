import { useState } from 'react'
import type { CrossrefWork, SearchFilters } from '../lib/crossref'
import { clearErrorLog, getErrorLog, recordError } from '../lib/telemetry'
import { CitationActions } from './CitationActions'
import { PdfLink } from './PdfLink'
import { ReferenceList } from './ReferenceList'
import { SearchFilterBar } from './SearchFilterBar'
import { WorkCard } from './WorkCard'

const work: CrossrefWork = {
  DOI: '10.1234/gallery',
  title: ['A gallery paper with a title long enough to wrap onto a second line'],
  author: [
    { given: 'Richard P.', family: 'Feynman' },
    { given: 'John A.', family: 'Wheeler' },
  ],
  'container-title': ['Journal of Tests'],
  issued: { 'date-parts': [[1965]] },
  type: 'journal-article',
  subject: ['Physics'],
  'is-referenced-by-count': 42,
  reference: [
    {
      key: 'a',
      DOI: '10.1234/referenced',
      'article-title': 'A referenced paper',
      'journal-title': 'Journal of Tests',
      year: '1960',
    },
    { 'article-title': 'A reference without a DOI', year: '1958' },
  ],
  link: [{ URL: 'https://example.org/paper.pdf', 'content-type': 'application/pdf' }],
}

const noRefs: CrossrefWork = {
  DOI: '10.1234/no-refs',
  title: ['A record with nothing deposited'],
  type: 'book',
}

export function DevGallery() {
  const [filters, setFilters] = useState<SearchFilters>({ sort: 'relevance' })
  const [errors, setErrors] = useState(getErrorLog)

  function refreshErrors() {
    setErrors(getErrorLog())
  }

  return (
    <div className="gallery">
      <h1>Component gallery</h1>
      <p className="hint">
        Every component in its states, for fast visual review. <a href="/">Back to search</a>
      </p>

      <section>
        <h2>Buttons</h2>
        <div className="btn-row">
          <button type="button" className="btn btn-primary">
            Primary
          </button>
          <button type="button" className="btn">
            Default
          </button>
          <button type="button" className="btn btn-ghost">
            Ghost
          </button>
          <button type="button" className="btn btn-danger">
            Danger
          </button>
          <button type="button" className="btn" disabled>
            Disabled
          </button>
        </div>
      </section>

      <section>
        <h2>Tags and toggles</h2>
        <div className="work-tags">
          <span className="tag">Journal article</span>
          <span className="tag">1,200 citations</span>
          <span className="tag tag-saved">Saved</span>
        </div>
        <div className="filters">
          <button type="button" className="filter-toggle" aria-pressed="false">
            Has abstract
          </button>
          <button type="button" className="filter-toggle" aria-pressed="true">
            Has references
          </button>
        </div>
      </section>

      <section>
        <h2>Filter bar</h2>
        <SearchFilterBar filters={filters} onChange={setFilters} />
      </section>

      <section>
        <h2>Result cards</h2>
        <ul className="work-list">
          <WorkCard work={work} saved={false} onOpen={() => undefined} />
          <WorkCard work={{ ...work, DOI: '10.1234/saved' }} saved onOpen={() => undefined} />
        </ul>
      </section>

      <section>
        <h2>Loading skeletons</h2>
        <div className="skeleton" aria-busy="true" aria-label="Loading example">
          <div className="skeleton-row">
            <div className="skeleton-line w-80" />
            <div className="skeleton-line w-50" />
          </div>
          <div className="skeleton-row">
            <div className="skeleton-line w-80" />
            <div className="skeleton-line w-50" />
          </div>
        </div>
        <div className="detail-skeleton" aria-busy="true" aria-label="Loading detail example">
          <div className="skeleton-line w-80" />
          <div className="skeleton-line w-50" />
          <div className="skeleton-line w-60" />
        </div>
      </section>

      <section>
        <h2>Empty and error states</h2>
        <p className="state">No papers matched. Try a different title, author, or journal.</p>
        <div className="state error" role="alert">
          <p>Crossref is busy right now (rate limit). New requests are paused for about 5s.</p>
          <button type="button" className="btn">
            Try again
          </button>
        </div>
      </section>

      <section>
        <h2>References</h2>
        <ReferenceList references={work.reference} onOpenDoi={() => undefined} />
        <ReferenceList onOpenDoi={() => undefined} />
      </section>

      <section>
        <h2>Citation and PDF</h2>
        <CitationActions work={work} />
        <div className="btn-row">
          <PdfLink work={work} />
          <PdfLink work={noRefs} />
        </div>
      </section>

      <section>
        <h2>Import review</h2>
        <div className="import-review">
          <p className="hint">
            Found 3 new papers; 2 entries already in the library. 1 record without a DOI will be
            skipped.
          </p>
          <ul className="import-preview">
            <li>{work.title?.[0]}</li>
            <li>Another new paper</li>
            <li>…and 1 more</li>
          </ul>
          <div className="btn-row">
            <button type="button" className="btn btn-primary">
              Import 3
            </button>
            <button type="button" className="btn">
              Cancel
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2>Local error log</h2>
        <p className="hint">
          Development builds record uncaught errors here. Nothing leaves this browser.
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              recordError(new Error('Sample gallery error'), { kind: 'manual' })
              refreshErrors()
            }}
          >
            Record a sample error
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              clearErrorLog()
              refreshErrors()
            }}
            disabled={errors.length === 0}
          >
            Clear log
          </button>
        </div>
        {errors.length === 0 ? (
          <p className="hint">No errors recorded.</p>
        ) : (
          <ol className="gallery-log">
            {errors.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span className="tag">{entry.kind}</span> {entry.at} — {entry.message}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
