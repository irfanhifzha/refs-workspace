import { useEffect, useRef, useState } from 'react'
import type { CrossrefWork } from '../lib/crossref'
import type { CitationStyle } from '../lib/citations'
import { CITATION_STYLES, formatCitation, toBibtex } from '../lib/citations'

type Copied = 'citation' | 'bibtex' | null

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

function styleLabel(style: CitationStyle) {
  return CITATION_STYLES.find((option) => option.value === style)?.label ?? style
}

export function CitationActions({ work }: { work: CrossrefWork }) {
  const [style, setStyle] = useState<CitationStyle>('apa')
  const [copied, setCopied] = useState<Copied>(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy(kind: Copied) {
    if (!kind) return
    try {
      await copyToClipboard(
        kind === 'bibtex' ? toBibtex(work) : formatCitation(style, work),
      )
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
        <label className="citation-style">
          <span className="visually-hidden">Citation style</span>
          <select
            className="filter-input"
            value={style}
            onChange={(event) => setStyle(event.target.value as CitationStyle)}
          >
            {CITATION_STYLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => copy('citation')}>
          {copied === 'citation' ? 'Copied' : 'Copy citation'}
        </button>
        <button type="button" className="btn" onClick={() => copy('bibtex')}>
          {copied === 'bibtex' ? 'Copied BibTeX' : 'Copy BibTeX'}
        </button>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {copied === 'citation'
          ? `${styleLabel(style)} citation copied`
          : copied === 'bibtex'
            ? 'BibTeX entry copied'
            : ''}
      </p>
      {failed && <p className="hint">Could not access the clipboard. Select the citation manually.</p>}
    </div>
  )
}
