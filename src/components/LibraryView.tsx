import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { LibraryEntry, ReadingStatus } from '../lib/storage'
import { STATUSES, STATUS_LABELS, serializeLibrary } from '../lib/storage'
import { parseImportFile } from '../lib/importers'
import { authorLine, parseYear, workTitle } from '../lib/crossref'
import { toBibtex } from '../lib/citations'
import { copyToClipboard } from '../lib/clipboard'
import { STALE_DAYS, isStale } from '../hooks/useLibrary'

type Filter = 'all' | ReadingStatus

type Props = {
  entries: LibraryEntry[]
  ready: boolean
  onOpen: (doi: string) => void
  onRemove: (doi: string) => void
  onStatus: (doi: string, status: ReadingStatus) => void
  onNote: (doi: string, note: string) => void
  onMove: (doi: string, direction: -1 | 1) => void
  onRefresh: (days: number) => Promise<{ refreshed: number; failed: number; total: number }>
  onImport: (entries: LibraryEntry[]) => { added: number; skipped: number }
}

type Notice = { kind: 'ok' | 'error'; text: string }

type PendingImport = {
  entries: LibraryEntry[]
  duplicates: number
  skipped: number
}

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  ...STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
]

function downloadFile(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadBibtex(entries: LibraryEntry[]) {
  downloadFile(
    'refs-workspace.bib',
    entries.map((entry) => toBibtex(entry.work)).join('\n\n'),
    'application/x-bibtex;charset=utf-8',
  )
}

function downloadJson(entries: LibraryEntry[]) {
  downloadFile(
    'refs-workspace-library.json',
    serializeLibrary(entries),
    'application/json;charset=utf-8',
  )
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function NoteField({ value, onSave }: { value: string; onSave: (note: string) => void }) {
  const [draft, setDraft] = useState(value)
  const committed = useRef(value)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value
      setDraft(value)
    }
  }, [value])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function handleChange(next: string) {
    setDraft(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      committed.current = next
      onSave(next)
    }, 500)
  }

  return (
    <label className="note-label">
      <span className="visually-hidden">Note</span>
      <textarea
        className="note"
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => {
          window.clearTimeout(timer.current)
          if (draft !== committed.current) {
            committed.current = draft
            onSave(draft)
          }
        }}
        placeholder="Add a note…"
        rows={2}
      />
    </label>
  )
}

export function LibraryView({
  entries,
  ready,
  onOpen,
  onRemove,
  onStatus,
  onNote,
  onMove,
  onRefresh,
  onImport,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [panel, setPanel] = useState<'import' | 'export' | null>(null)
  const [pasted, setPasted] = useState('')
  const staleCount = entries.filter((entry) => isStale(entry)).length

  const counts: Record<Filter, number> = {
    all: entries.length,
    'to-read': entries.filter((entry) => entry.status === 'to-read').length,
    reading: entries.filter((entry) => entry.status === 'reading').length,
    done: entries.filter((entry) => entry.status === 'done').length,
  }

  const visible = filter === 'all' ? entries : entries.filter((entry) => entry.status === filter)

  function previewImport(name: string, text: string) {
    try {
      const parsed = parseImportFile(name, text)
      if (parsed.entries.length === 0) {
        throw new Error(
          parsed.skipped > 0
            ? `None of those ${plural(parsed.skipped, 'entry')} includes a DOI. Crossref needs one to save a paper.`
            : 'No library entries were found in that text.',
        )
      }
      // Preview against the current library (and earlier rows in the input) before merging.
      const known = new Set(entries.map((entry) => entry.doi.toLowerCase()))
      const fresh: LibraryEntry[] = []
      let duplicates = 0
      for (const entry of parsed.entries) {
        const key = entry.doi.toLowerCase()
        if (known.has(key)) {
          duplicates += 1
          continue
        }
        known.add(key)
        fresh.push(entry)
      }
      setNotice(null)
      setPending({ entries: fresh, duplicates, skipped: parsed.skipped })
      setPanel(null)
      setPasted('')
    } catch (error) {
      setPending(null)
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not read that import.',
      })
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset so importing the same file again still fires a change event.
    event.target.value = ''
    if (!file) return
    previewImport(file.name, await file.text())
  }

  function handlePasteImport() {
    const text = pasted.trim()
    if (text) previewImport('', text)
  }

  async function handleCopyJson() {
    try {
      await copyToClipboard(serializeLibrary(entries))
      setNotice({
        kind: 'ok',
        text: `Copied ${plural(entries.length, 'paper')} as JSON. Paste it into another browser's import panel.`,
      })
    } catch {
      setNotice({
        kind: 'error',
        text: 'Could not copy the JSON. Your browser may block the clipboard.',
      })
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setNotice(null)
    try {
      const { refreshed, failed } = await onRefresh(STALE_DAYS)
      setNotice({
        kind: failed > 0 ? 'error' : 'ok',
        text:
          failed > 0
            ? `Refreshed ${plural(refreshed, 'entry')}; ${plural(failed, 'entry')} could not be updated.`
            : `Refreshed ${plural(refreshed, 'entry')} from Crossref.`,
      })
    } finally {
      setRefreshing(false)
    }
  }

  function applyImport() {
    if (!pending) return
    const { added, skipped } = onImport(pending.entries)
    setNotice({
      kind: 'ok',
      text:
        added === 0
          ? `No new papers — all ${plural(skipped, 'entry')} are already in the library.`
          : skipped > 0
            ? `Imported ${plural(added, 'paper')}; ${plural(skipped, 'entry')} already in the library.`
            : `Imported ${plural(added, 'paper')}.`,
    })
    setPending(null)
  }

  return (
    <div className="library">
      <h1 className="visually-hidden">Library</h1>

      <div className="library-toolbar">
        <div className="tabs" role="group" aria-label="Filter by reading status">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="tab"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label} <span className="count">{counts[option.value]}</span>
            </button>
          ))}
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={handleRefresh}
            disabled={refreshing || staleCount === 0}
          >
            {refreshing
              ? 'Refreshing…'
              : staleCount > 0
                ? `Refresh ${staleCount} ${staleCount === 1 ? 'entry' : 'entries'}`
                : 'Metadata current'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setPanel(panel === 'export' ? null : 'export')}
            aria-expanded={panel === 'export'}
            aria-controls="io-panel"
            disabled={entries.length === 0}
          >
            Export
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setPanel(panel === 'import' ? null : 'import')}
            aria-expanded={panel === 'import'}
            aria-controls="io-panel"
          >
            Import
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => downloadBibtex(entries)}
            disabled={entries.length === 0}
          >
            Export BibTeX
          </button>
        </div>
      </div>

      {panel && (
        <section
          id="io-panel"
          className="import-review io-panel"
          aria-label={panel === 'import' ? 'Import library' : 'Export library'}
        >
          {panel === 'export' ? (
            <>
              <p className="hint">
                Download a JSON backup, or copy the JSON to paste into the import panel on another
                device. Notes, statuses, and reading order are included.
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => downloadJson(entries)}
                >
                  Download JSON
                </button>
                <button type="button" className="btn" onClick={handleCopyJson}>
                  Copy JSON
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setPanel(null)}>
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="hint">
                Choose a JSON export, or paste its contents below. BibTeX and RIS files still import
                too, and everything is previewed before it is added.
              </p>
              <div className="btn-row">
                <label className="btn">
                  Choose file
                  <input
                    type="file"
                    accept=".json,.bib,.ris,.txt,application/json,application/x-bibtex,text/plain"
                    className="visually-hidden"
                    onChange={handleImportFile}
                  />
                </label>
                <button type="button" className="btn btn-ghost" onClick={() => setPanel(null)}>
                  Close
                </button>
              </div>
              <label className="io-label">
                <span>Paste library JSON</span>
                <textarea
                  className="io-textarea"
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                  placeholder={'{\n  "entries": [ … ]\n}'}
                  spellCheck={false}
                />
              </label>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn"
                  disabled={!pasted.trim()}
                  onClick={handlePasteImport}
                >
                  Review pasted JSON
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {pending && (
        <section className="import-review" aria-label="Review import">
          <p className="hint">
            {pending.entries.length === 0
              ? `Nothing new — all ${plural(pending.duplicates, 'entry')} are already in the library.`
              : `Found ${plural(pending.entries.length, 'new paper')}` +
                (pending.duplicates > 0
                  ? `; ${plural(pending.duplicates, 'entry')} already in the library.`
                  : '.')}
            {pending.skipped > 0 &&
              ` ${plural(pending.skipped, 'record')} without a DOI will be skipped.`}
          </p>
          {pending.entries.length > 0 && (
            <ul className="import-preview">
              {pending.entries.slice(0, 5).map((entry) => (
                <li key={entry.doi}>{workTitle(entry.work)}</li>
              ))}
              {pending.entries.length > 5 && (
                <li>…and {pending.entries.length - 5} more</li>
              )}
            </ul>
          )}
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending.entries.length === 0}
              onClick={applyImport}
            >
              Import {pending.entries.length}
            </button>
            <button type="button" className="btn" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {notice && (
        <p
          className={notice.kind === 'error' ? 'state error' : 'hint'}
          role="status"
          aria-live="polite"
        >
          {notice.text}
        </p>
      )}

      {!ready && (
        <p className="state" role="status">
          Loading library…
        </p>
      )}

      {ready && entries.length === 0 && (
        <p className="state" role="status">
          Nothing saved yet. Search for a paper and use “Save to library”.
        </p>
      )}

      {ready && entries.length > 0 && visible.length === 0 && (
        <p className="state" role="status">
          No papers in this list.
        </p>
      )}

      {ready && visible.length > 0 && (
        <ul className="library-list">
          {visible.map((entry) => {
            const meta = [
              authorLine(entry.work, true),
              parseYear(entry.work),
              entry.work['container-title']?.[0],
            ]
              .filter(Boolean)
              .join(' · ')
            const queueIndex = visible.findIndex((item) => item.doi === entry.doi)

            return (
              <li key={entry.doi} className="library-item">
                <div className="library-item-head">
                  <div className="library-item-title">
                    <button
                      type="button"
                      className="work-card-title"
                      onClick={() => onOpen(entry.doi)}
                    >
                      {workTitle(entry.work)}
                    </button>
                    {meta && <p className="work-meta">{meta}</p>}
                    {entry.updatedAt && (
                      <p className="work-meta">
                        Metadata updated {new Date(entry.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="library-actions">
                    {filter === 'to-read' && entry.status === 'to-read' && (
                      <div className="queue-order" role="group" aria-label="Reading queue order">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          aria-label={`Move ${workTitle(entry.work)} up`}
                          disabled={queueIndex <= 0}
                          onClick={() => onMove(entry.doi, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          aria-label={`Move ${workTitle(entry.work)} down`}
                          disabled={queueIndex === -1 || queueIndex >= visible.length - 1}
                          onClick={() => onMove(entry.doi, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    )}
                    <label className="status-label">
                      <span className="visually-hidden">Reading status</span>
                      <select
                        className="status"
                        value={entry.status}
                        onChange={(event) =>
                          onStatus(entry.doi, event.target.value as ReadingStatus)
                        }
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-danger"
                      onClick={() => onRemove(entry.doi)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <NoteField value={entry.note} onSave={(note) => onNote(entry.doi, note)} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
