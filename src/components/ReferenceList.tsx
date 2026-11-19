import { useState } from 'react'
import type { CrossrefReference } from '../lib/crossref'

const INITIAL_LIMIT = 25

function referenceText(reference: CrossrefReference): string {
  if (reference.unstructured) return reference.unstructured

  const parts = [
    reference.author,
    reference.year ? `(${reference.year})` : undefined,
    reference['article-title'],
    reference['journal-title'],
    reference.volume,
    reference['first-page'],
  ].filter((part): part is string => Boolean(part))

  return parts.length > 0 ? `${parts.join('. ')}.` : 'Reference details not available.'
}

type Props = {
  references?: CrossrefReference[]
  onOpenDoi: (doi: string) => void
}

export function ReferenceList({ references, onOpenDoi }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!references || references.length === 0) {
    return (
      <section className="refs">
        <h3>References</h3>
        <p className="hint">No references were deposited with this record.</p>
      </section>
    )
  }

  const visible = expanded ? references : references.slice(0, INITIAL_LIMIT)

  return (
    <section className="refs">
      <h3>
        References <span className="count">{references.length}</span>
      </h3>
      <ol>
        {visible.map((reference, index) => {
          const label = reference['article-title'] ?? reference.author ?? 'reference'
          return (
            <li key={reference.key ?? `ref-${index}`} className="ref-line">
              <span>{referenceText(reference)}</span>
              {reference.DOI && (
                <span className="ref-links">
                  <button
                    type="button"
                    className="ref-open"
                    aria-label={`Open ${label} in the app`}
                    onClick={() => onOpenDoi(reference.DOI as string)}
                  >
                    Open
                  </button>
                  <a
                    href={`https://doi.org/${reference.DOI}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${label} on doi.org`}
                  >
                    doi.org
                  </a>
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {!expanded && references.length > INITIAL_LIMIT && (
        <div className="load-more">
          <button type="button" className="btn" onClick={() => setExpanded(true)}>
            Show all {references.length} references
          </button>
        </div>
      )}
    </section>
  )
}
