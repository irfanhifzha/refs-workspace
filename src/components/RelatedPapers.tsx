import { useEffect, useRef, useState } from 'react'
import type { CrossrefWork } from '../lib/crossref'
import { errorMessage, findRelatedWorks, isAbortError } from '../lib/crossref'
import { WorkCard } from './WorkCard'

type Props = {
  work: CrossrefWork
  isSaved: (doi: string) => boolean
  onOpenDoi: (doi: string) => void
}

type State = {
  status: 'idle' | 'loading' | 'done' | 'error'
  items: CrossrefWork[]
  error: string | null
}

export function RelatedPapers({ work, isSaved, onOpenDoi }: Props) {
  const [state, setState] = useState<State>({ status: 'idle', items: [], error: null })
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  async function load() {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    setState({ status: 'loading', items: [], error: null })

    try {
      const items = await findRelatedWorks(work, next.signal)
      if (next.signal.aborted) return
      setState({ status: 'done', items, error: null })
    } catch (error) {
      if (isAbortError(error) || next.signal.aborted) return
      setState({ status: 'error', items: [], error: errorMessage(error) })
    }
  }

  return (
    <section className="related">
      <h3>Related papers</h3>

      {state.status === 'idle' && (
        <>
          <p className="hint">
            Find papers with a similar title and author. This costs one Crossref request, then stays
            cached for this session.
          </p>
          <button type="button" className="btn" onClick={load}>
            Find related papers
          </button>
        </>
      )}

      {state.status === 'loading' && (
        <div className="skeleton" aria-busy="true" aria-label="Finding related papers">
          <div className="skeleton-row">
            <div className="skeleton-line w-80" />
            <div className="skeleton-line w-50" />
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="state error" role="alert">
          <p>{state.error}</p>
          <button type="button" className="btn" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {state.status === 'done' && state.items.length === 0 && (
        <p className="hint">No close matches found for this paper.</p>
      )}

      {state.status === 'done' && state.items.length > 0 && (
        <ul className="work-list">
          {state.items.map((item) => (
            <WorkCard
              key={item.DOI}
              work={item}
              saved={isSaved(item.DOI)}
              onOpen={onOpenDoi}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
