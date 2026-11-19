import type { CrossrefWork } from '../lib/crossref'
import { authorLine, doiUrl, parseYear, typeLabel } from '../lib/crossref'
import { useWork } from '../hooks/useWork'
import { CitationActions } from './CitationActions'
import { ReferenceList } from './ReferenceList'
import { RelatedPapers } from './RelatedPapers'

type Props = {
  doi: string
  onBack: () => void
  onOpenDoi: (doi: string) => void
  saved: boolean
  isSaved: (doi: string) => boolean
  onSave: (work: CrossrefWork) => void
}

export function WorkDetail({ doi, onBack, onOpenDoi, saved, isSaved, onSave }: Props) {
  const { work, loading, error, retry } = useWork(doi)

  return (
    <div className="detail">
      <button type="button" className="btn btn-ghost back" onClick={onBack}>
        <span aria-hidden="true">←</span> Back
      </button>

      {loading && (
        <div className="detail-skeleton" aria-busy="true" aria-label="Loading paper">
          <div className="skeleton-line w-80" />
          <div className="skeleton-line w-50" />
          <div className="skeleton-line w-60" />
        </div>
      )}

      {!loading && error && (
        <div className="state error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && work && (
        <article>
          <h2>{work.title?.[0] ?? work.subtitle?.[0] ?? `Untitled record (${work.DOI})`}</h2>

          {work.author && work.author.length > 0 && (
            <p className="detail-authors">{authorLine(work)}</p>
          )}

          <div className="btn-row detail-actions">
            {saved ? (
              <button type="button" className="btn" disabled>
                In library
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => onSave(work)}>
                Save to library
              </button>
            )}
            <CitationActions work={work} />
          </div>

          <dl className="meta-grid">
            {work['container-title']?.[0] && (
              <div>
                <dt>Journal</dt>
                <dd>{work['container-title'][0]}</dd>
              </div>
            )}
            {parseYear(work) && (
              <div>
                <dt>Year</dt>
                <dd>{parseYear(work)}</dd>
              </div>
            )}
            {typeLabel(work.type) && (
              <div>
                <dt>Type</dt>
                <dd>{typeLabel(work.type)}</dd>
              </div>
            )}
            {(work.volume || work.issue) && (
              <div>
                <dt>Volume / issue</dt>
                <dd>{[work.volume, work.issue && `(${work.issue})`].filter(Boolean).join(' ')}</dd>
              </div>
            )}
            {work.page && (
              <div>
                <dt>Pages</dt>
                <dd>{work.page}</dd>
              </div>
            )}
            {work.publisher && (
              <div>
                <dt>Publisher</dt>
                <dd>{work.publisher}</dd>
              </div>
            )}
            <div>
              <dt>DOI</dt>
              <dd>
                <a href={doiUrl(work.DOI)} target="_blank" rel="noreferrer">
                  {work.DOI}
                </a>
              </dd>
            </div>
            {typeof work['is-referenced-by-count'] === 'number' && (
              <div>
                <dt>Cited by</dt>
                <dd>{work['is-referenced-by-count'].toLocaleString()}</dd>
              </div>
            )}
          </dl>

          {work.abstract && (
            <section className="abstract">
              <h3>Abstract</h3>
              <p>{work.abstract}</p>
            </section>
          )}

          <ReferenceList references={work.reference} onOpenDoi={onOpenDoi} />

          <RelatedPapers work={work} isSaved={isSaved} onOpenDoi={onOpenDoi} />
        </article>
      )}
    </div>
  )
}
