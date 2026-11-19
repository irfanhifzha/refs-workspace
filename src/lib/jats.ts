let parser: DOMParser | null = null

/**
 * Crossref titles and abstracts often contain HTML or JATS XML (e.g.
 * `<jats:p>Text</jats:p>`). Render them as plain text so React always gets a
 * string and never needs dangerouslySetInnerHTML.
 */
export function toPlainText(value: string): string {
  const source = value.trim()
  if (!source) return ''
  if (!/<\/?[a-z][^>]*>|&[a-z#0-9]+;/i.test(source)) return source

  parser ??= new DOMParser()
  const text = parser.parseFromString(source, 'text/html').body.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim()
}
