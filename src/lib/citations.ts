import type { CrossrefAuthor, CrossrefWork } from './crossref'
import { parseYear, workTitle } from './crossref'

const BIB_TYPES: Record<string, string> = {
  'journal-article': 'article',
  'book-chapter': 'incollection',
  'proceedings-article': 'inproceedings',
  book: 'book',
  monograph: 'book',
  'edited-book': 'book',
  'reference-entry': 'incollection',
  dissertation: 'phdthesis',
  report: 'techreport',
}

function initials(given?: string): string {
  if (!given) return ''
  return given
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}.`)
    .join(' ')
}

function apaName(author: CrossrefAuthor): string {
  if (author.family) return author.given ? `${author.family}, ${initials(author.given)}` : author.family
  return author.name ?? ''
}

function apaAuthors(work: CrossrefWork): string {
  const names = (work.author ?? []).map(apaName).filter(Boolean)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]}, & ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`
}

function trimEnd(text: string): string {
  return text.replace(/[.\s]+$/, '')
}

/** Approximate APA 7 reference. Not a full CSL implementation. */
export function formatApa(work: CrossrefWork): string {
  const authors = apaAuthors(work)
  const year = parseYear(work) ?? 'n.d.'
  const parts: string[] = []

  parts.push(authors ? `${authors} (${year}).` : `(${year}).`)
  parts.push(`${trimEnd(workTitle(work))}.`)

  const journal = work['container-title']?.[0]
  if (journal) {
    let source = journal
    if (work.volume) source += `, ${work.volume}`
    if (work.issue) source += `(${work.issue})`
    if (work.page) source += `, ${work.page.replace(/\s*[-–]\s*/g, '–')}`
    parts.push(`${source}.`)
  } else if (work.publisher) {
    parts.push(`${trimEnd(work.publisher)}.`)
  }

  if (work.DOI) parts.push(`https://doi.org/${work.DOI}`)

  return parts.join(' ')
}

function bibValue(value: string): string {
  return value
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}])/g, '\\$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function bibKey(work: CrossrefWork): string {
  const family = work.author?.[0]?.family?.split(/\s+/)[0] ?? 'ref'
  const year = parseYear(work) ?? ''
  const word = work.title?.[0]?.match(/[A-Za-z0-9]+/)?.[0] ?? ''
  const key = `${family}${year}${word}`.toLowerCase().replace(/[^a-z0-9]/g, '')
  return key || 'ref'
}

export function toBibtex(work: CrossrefWork): string {
  const entryType = BIB_TYPES[work.type ?? ''] ?? 'misc'
  const container = work['container-title']?.[0]
  const authors = (work.author ?? [])
    .map((author) => {
      if (author.family) return author.given ? `${author.family}, ${author.given}` : author.family
      return author.name ?? ''
    })
    .filter(Boolean)
    .join(' and ')

  const fields: Array<[string, string | undefined]> = [
    ['title', work.title?.[0]],
    ['author', authors || undefined],
  ]

  if (entryType === 'article') fields.push(['journal', container])
  else if (entryType === 'incollection' || entryType === 'inproceedings')
    fields.push(['booktitle', container])

  fields.push(
    ['year', parseYear(work) ?? undefined],
    ['volume', work.volume],
    ['number', work.issue],
    ['pages', work.page?.replace(/\s*[-–]\s*/g, '--')],
    ['publisher', work.publisher],
    ['doi', work.DOI],
    ['url', work.URL],
  )

  const lines = fields
    .filter((field): field is [string, string] => Boolean(field[1]))
    .map(([name, value]) => `  ${name} = {${bibValue(value)}},`)

  return `@${entryType}{${bibKey(work)},\n${lines.join('\n')}\n}`
}
