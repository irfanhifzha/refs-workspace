type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}

export function SearchBar({ value, onChange, onSubmit }: Props) {
  return (
    <form
      className="search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(value)
      }}
    >
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Title, author, or journal"
        aria-label="Search papers on Crossref"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
      />
    </form>
  )
}
