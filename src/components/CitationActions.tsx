import { useEffect, useRef, useState } from 'react'
import type { CrossrefWork } from '../lib/crossref'
import { formatApa, toBibtex } from '../lib/citations'

type Kind = 'apa' | 'bibtex'

async function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }

  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  area.remove()
  if (!copied) throw new Error('Copy failed')
}

export function CitationActions({ work }: { work: CrossrefWork }) {
  const [copied, setCopied] = useState<Kind | null>(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy(kind: Kind) {
    try {
      await copyToClipboard(kind === 'apa' ? formatApa(work) : toBibtex(work))
      setCopied(kind)
      setFailed(false)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
      setFailed(true)
    }
  }

  return (
    <div className="citation-actions">
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => copy('apa')}>
          {copied === 'apa' ? 'Copied APA' : 'Copy APA'}
        </button>
        <button type="button" className="btn" onClick={() => copy('bibtex')}>
          {copied === 'bibtex' ? 'Copied BibTeX' : 'Copy BibTeX'}
        </button>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {copied ? `${copied === 'apa' ? 'APA' : 'BibTeX'} citation copied` : ''}
      </p>
      {failed && <p className="hint">Could not access the clipboard. Select the citation manually.</p>}
    </div>
  )
}
