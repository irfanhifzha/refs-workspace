import type { CrossrefWork } from '../lib/crossref'
import { authorLine, parseYear, typeLabel, workTitle } from '../lib/crossref'

type Props = {
  work: CrossrefWork
  saved: boolean
  onOpen: (doi: string) => void
}

export function WorkCard({ work, saved, onOpen }: Props) {
  const meta = [
    authorLine(work, true),
    work['container-title']?.[0],
    parseYear(work),
  ]
    .filter(Boolean)
    .join(' · ')

  const citations = work['is-referenced-by-count']

  return (
    <li className="work-card">
      <button type="button" className="work-card-title" onClick={() => onOpen(work.DOI)}>
        {workTitle(work)}
      </button>
      {meta && <p className="work-meta">{meta}</p>}
      <div className="work-tags">
        {typeLabel(work.type) && <span className="tag">{typeLabel(work.type)}</span>}
        {typeof citations === 'number' && (
          <span className="tag">{citations.toLocaleString()} citations</span>
        )}
        {saved && <span className="tag tag-saved">Saved</span>}
      </div>
    </li>
  )
}
