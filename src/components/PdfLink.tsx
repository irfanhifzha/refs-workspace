import { useRef, useState } from 'react'
import type { CrossrefWork } from '../lib/crossref'
import { crossrefPdfUrl, findOpenAccess, hasOpenAccessLookup } from '../lib/openaccess'

type State = {
  status: 'idle' | 'loading' | 'done' | 'error'
  pdfUrl?: string | null
  landingUrl?: string | null
  error?: string
}

export function PdfLink({ work }: { work: CrossrefWork }) {
  const [state, setState] = useState<State>({ status: 'idle' })
  const controller = useRef<AbortController | null>(null)

  const deposited = crossrefPdfUrl(work)
  if (deposited) {
    return (
      <a className="btn" href={deposited} target="_blank" rel="noreferrer">
        Open PDF
      </a>
    )
  }

  if (!hasOpenAccessLookup()) return null

  async function look() {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    setState({ status: 'loading' })

    try {
      const result = await findOpenAccess(work.DOI, next.signal)
      if (next.signal.aborted) return
      setState({
        status: 'done',
        pdfUrl: result.pdfUrl,
        landingUrl: result.landingUrl,
      })
    } catch (error) {
      if (next.signal.aborted) return
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not look up a PDF.',
      })
    }
  }

  return (
    <div className="pdf-link">
      {state.status !== 'done' && (
        <button
          type="button"
          className="btn"
          onClick={look}
          disabled={state.status === 'loading'}
        >
          {state.status === 'loading' ? 'Looking for PDF…' : 'Find open-access PDF'}
        </button>
      )}

      {state.status === 'done' && state.pdfUrl && (
        <a className="btn btn-primary" href={state.pdfUrl} target="_blank" rel="noreferrer">
          Open PDF
        </a>
      )}

      {state.status === 'done' && !state.pdfUrl && state.landingUrl && (
        <a className="btn" href={state.landingUrl} target="_blank" rel="noreferrer">
          Open access page
        </a>
      )}

      {state.status === 'done' && !state.pdfUrl && !state.landingUrl && (
        <p className="hint" role="status">
          No open-access copy found for this paper.
        </p>
      )}

      {state.status === 'error' && (
        <p className="hint" role="alert">
          {state.error}
        </p>
      )}
    </div>
  )
}
