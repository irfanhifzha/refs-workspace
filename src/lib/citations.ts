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

export type CitationStyle = 'apa' | 'chicago' | 'harvard' | 'ieee' | 'mla' | 'vancouver'

export const CITATION_STYLES: Array<{ value: CitationStyle; label: string }> = [
  { value: 'apa', label: 'APA 7' },
  { value: 'chicago', label: 'Chicago' },
  { value: 'harvard', label: 'Harvard' },
  { value: 'ieee', label: 'IEEE' },
  { value: 'mla', label: 'MLA 9' },
  { value: 'vancouver', label: 'Vancouver' },
]

function dashPages(page?: string): string | undefined {
  return page?.replace(/\s*[-–]\s*/g, '–')
}

function tightInitials(given?: string): string {
  if (!given) return ''
  return given
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function chicagoAuthors(work: CrossrefWork): string {
  const names = (work.author ?? [])
    .map((author, index) => {
      if (!author.family) return author.name ?? ''
      // First author inverts the name; the rest read naturally.
      if (index === 0) return author.given ? `${author.family}, ${author.given}` : author.family
      return author.given ? `${author.given} ${author.family}` : author.family
    })
    .filter(Boolean)

  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function ieeeAuthors(work: CrossrefWork): string {
  const names = (work.author ?? [])
    .map((author) =>
      author.family ? `${initials(author.given)} ${author.family}`.trim() : (author.name ?? ''),
    )
    .filter(Boolean)

  if (names.length <= 1) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function vancouverAuthors(work: CrossrefWork): string {
  return (work.author ?? [])
    .map((author) =>
      author.family
        ? `${author.family} ${tightInitials(author.given)}`.trim()
        : (author.name ?? ''),
    )
    .filter(Boolean)
    .join(', ')
}

function harvardAuthors(work: CrossrefWork): string {
  const names = (work.author ?? [])
    .map((author) =>
      author.family
        ? author.given
          ? `${author.family}, ${initials(author.given)}`
          : author.family
        : (author.name ?? ''),
    )
    .filter(Boolean)

  if (names.length <= 1) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function sourceLine(work: CrossrefWork): string {
  const journal = work['container-title']?.[0]
  if (!journal) return work.publisher ? `${trimEnd(work.publisher)}` : ''

  let source = journal
  if (work.volume) source += `, ${work.volume}`
  if (work.issue) source += `(${work.issue})`
  if (work.page) source += `, ${dashPages(work.page)}`
  return source
}

function ieeeSource(work: CrossrefWork): string {
  const journal = work['container-title']?.[0]
  if (!journal) return work.publisher ? trimEnd(work.publisher) : ''

  let source = journal
  if (work.volume) source += `, vol. ${work.volume}`
  if (work.issue) source += `, no. ${work.issue}`
  if (work.page) source += `, pp. ${dashPages(work.page)}`
  return source
}

/** Approximate Chicago author-date bibliography entry. */
export function formatChicago(work: CrossrefWork): string {
  const authors = chicagoAuthors(work)
  const year = parseYear(work) ?? 'n.d.'
  const title = trimEnd(workTitle(work))
  const source = sourceLine(work)
  const doi = work.DOI ? `https://doi.org/${work.DOI}` : ''

  return `${authors ? `${trimEnd(authors)}. ` : ''}${year}. “${title}.” ${source ? `${source}. ` : ''}${doi}`.trim()
}

/** Approximate Harvard bibliography entry. */
export function formatHarvard(work: CrossrefWork): string {
  const authors = harvardAuthors(work)
  const year = parseYear(work) ?? 'n.d.'
  const title = trimEnd(workTitle(work))
  const journal = work['container-title']?.[0]
  const source = journal
    ? `${journal}${work.volume ? `, ${work.volume}` : ''}${work.issue ? `(${work.issue})` : ''}${work.page ? `, pp. ${dashPages(work.page)}` : ''}`
    : work.publisher
      ? trimEnd(work.publisher)
      : ''
  const doi = work.DOI ? `doi: ${work.DOI}.` : ''

  return `${authors ? `${authors} ` : ''}(${year}) '${title}', ${source ? `${source}. ` : ''}${doi}`.trim()
}

/** Approximate IEEE entry. */
export function formatIeee(work: CrossrefWork): string {
  const authors = ieeeAuthors(work)
  const year = parseYear(work) ?? 'n.d.'
  const title = trimEnd(workTitle(work))
  const source = ieeeSource(work)
  const doi = work.DOI ? `doi: ${work.DOI}` : ''

  const lead = authors ? `${authors}, ` : ''
  return `${lead}“${title},” ${source ? `${source}, ` : ''}${year}${doi ? `, ${doi}` : ''}.`
}

/** Approximate MLA 9 works-cited entry. */
export function formatMla(work: CrossrefWork): string {
  const authors = chicagoAuthors(work)
  const title = trimEnd(workTitle(work))
  const journal = work['container-title']?.[0]
  const year = parseYear(work)
  const doi = work.DOI ? `https://doi.org/${work.DOI}.` : ''

  let source = ''
  if (journal) {
    source = `${journal}${work.volume ? `, vol. ${work.volume}` : ''}${work.issue ? `, no. ${work.issue}` : ''}${year ? `, ${year}` : ''}${work.page ? `, pp. ${dashPages(work.page)}` : ''}. `
  } else if (work.publisher) {
    source = `${trimEnd(work.publisher)}${year ? `, ${year}` : ''}. `
  }

  return `${authors ? `${trimEnd(authors)}. ` : ''}“${title}.” ${source}${doi}`.trim()
}

/** Approximate Vancouver / NLM entry. */
export function formatVancouver(work: CrossrefWork): string {
  const authors = vancouverAuthors(work)
  const title = trimEnd(workTitle(work))
  const journal = work['container-title']?.[0]
  const year = parseYear(work)
  const doi = work.DOI ? `doi:${work.DOI}` : ''

  let source = ''
  if (journal) {
    source = `${journal}. ${year ?? 'n.d.'}`
    if (work.volume) source += `;${work.volume}`
    if (work.issue) source += `(${work.issue})`
    if (work.page) source += `:${dashPages(work.page)}`
    source += '. '
  } else if (work.publisher) {
    source = `${trimEnd(work.publisher)}; ${year ?? 'n.d.'}. `
  }

  return `${authors ? `${authors}. ` : ''}${title}. ${source}${doi}`.trim()
}

export function formatCitation(style: CitationStyle, work: CrossrefWork): string {
  switch (style) {
    case 'chicago':
      return formatChicago(work)
    case 'harvard':
      return formatHarvard(work)
    case 'ieee':
      return formatIeee(work)
    case 'mla':
      return formatMla(work)
    case 'vancouver':
      return formatVancouver(work)
    default:
      return formatApa(work)
  }
}

function bibValue(value: string): string {
  return value
    // One pass so escaping a backslash doesn't escape the braces it introduces.
    .replace(/[\\{}]/g, (char) => (char === '\\' ? '\\textbackslash{}' : `\\${char}`))
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
