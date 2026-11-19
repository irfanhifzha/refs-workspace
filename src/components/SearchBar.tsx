import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

type Props = {
  value: string
  history: string[]
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}

export function SearchBar({ value, history, onChange, onSubmit }: Props) {
  // -1/null means the box holds what the user typed; otherwise it shows a history entry.
  const [recall, setRecall] = useState<number | null>(null)
  const draft = useRef('')

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    if (history.length === 0) return
    event.preventDefault()

    if (event.key === 'ArrowUp') {
      if (recall === null) {
        draft.current = value
        setRecall(0)
        onChange(history[0])
      } else if (recall < history.length - 1) {
        setRecall(recall + 1)
        onChange(history[recall + 1])
      }
      return
    }

    if (recall === null) return
    if (recall === 0) {
      setRecall(null)
      onChange(draft.current)
    } else {
      setRecall(recall - 1)
      onChange(history[recall - 1])
    }
  }

  return (
    <form
      className="search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        setRecall(null)
        onSubmit(value)
      }}
    >
      <input
        type="search"
        value={value}
        onChange={(event) => {
          setRecall(null)
          onChange(event.target.value)
        }}
        onKeyDown={handleKeyDown}
        placeholder="DOI, title, author, or journal"
        aria-label="Search papers on Crossref, or paste a DOI"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
      />
    </form>
  )
}
