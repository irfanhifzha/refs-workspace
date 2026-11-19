import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { LibraryEntry, ReadingStatus } from '../lib/storage'
import {
  STATUSES,
  STATUS_LABELS,
  parseLibraryJson,
  serializeLibrary,
} from '../lib/storage'
import { authorLine, parseYear, workTitle } from '../lib/crossref'
import { toBibtex } from '../lib/citations'

type Filter = 'all' | ReadingStatus

type Props = {
  entries: LibraryEntry[]
  onOpen: (doi: string) => void
  onRemove: (doi: string) => void
  onStatus: (doi: string, status: ReadingStatus) => void
  onNote: (doi: string, note: string) => void
  onImport: (entries: LibraryEntry[]) => { added: number; skipped: number }
}

type Notice = { kind: 'ok' | 'error'; text: string }

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
  onOpen,
  onRemove,
  onStatus,
  onNote,
  onImport,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [notice, setNotice] = useState<Notice | null>(null)

  const counts: Record<Filter, number> = {
    all: entries.length,
    'to-read': entries.filter((entry) => entry.status === 'to-read').length,
    reading: entries.filter((entry) => entry.status === 'reading').length,
    done: entries.filter((entry) => entry.status === 'done').length,
  }

  const visible = filter === 'all' ? entries : entries.filter((entry) => entry.status === filter)

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset so importing the same file again still fires a change event.
    event.target.value = ''
    if (!file) return

    try {
      const imported = parseLibraryJson(await file.text())
      const { added, skipped } = onImport(imported)
      if (added === 0) {
        setNotice({
          kind: 'ok',
          text: `No new papers — all ${plural(skipped, 'entry')} are already in the library.`,
        })
      } else {
        setNotice({
          kind: 'ok',
          text:
            skipped > 0
              ? `Imported ${plural(added, 'paper')}; ${plural(skipped, 'entry')} already in the library.`
              : `Imported ${plural(added, 'paper')}.`,
        })
      }
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not import that file.',
      })
    }
  }

  return (
    <div className="library">
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
            onClick={() => downloadBibtex(entries)}
            disabled={entries.length === 0}
          >
            Export BibTeX
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => downloadJson(entries)}
            disabled={entries.length === 0}
          >
            Export JSON
          </button>
          <label className="btn">
            Import JSON
            <input
              type="file"
              accept=".json,application/json"
              className="visually-hidden"
              onChange={handleImport}
            />
          </label>
        </div>
      </div>

      {notice && (
        <p
          className={notice.kind === 'error' ? 'state error' : 'hint'}
          role="status"
          aria-live="polite"
        >
          {notice.text}
        </p>
      )}

      {entries.length === 0 && (
        <p className="state">
          Nothing saved yet. Search for a paper and use “Save to library”.
        </p>
      )}

      {entries.length > 0 && visible.length === 0 && (
        <p className="state">No papers in this list.</p>
      )}

      {visible.length > 0 && (
        <ul className="library-list">
          {visible.map((entry) => {
            const meta = [
              authorLine(entry.work, true),
              parseYear(entry.work),
              entry.work['container-title']?.[0],
            ]
              .filter(Boolean)
              .join(' · ')

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
                  </div>

                  <div className="library-actions">
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
