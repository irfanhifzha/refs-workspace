import type { CrossrefAuthor, CrossrefWork } from './crossref'
import type { LibraryEntry } from './storage'
import { parseLibraryJson } from './storage'

export type ImportResult = {
  entries: LibraryEntry[]
  /** Records in the file that carried no DOI and therefore could not be saved. */
  skipped: number
}

const BIB_TYPES: Record<string, string> = {
  article: 'journal-article',
  incollection: 'book-chapter',
  inbook: 'book-chapter',
  inproceedings: 'proceedings-article',
  conference: 'proceedings-article',
  book: 'book',
  phdthesis: 'dissertation',
  mastersthesis: 'dissertation',
  techreport: 'report',
  misc: 'journal-article',
  unpublished: 'posted-content',
}

const RIS_TYPES: Record<string, string> = {
  JOUR: 'journal-article',
  CHAP: 'book-chapter',
  CONF: 'proceedings-article',
  BOOK: 'book',
  THES: 'dissertation',
  RPRT: 'report',
  DATA: 'dataset',
  ELEC: 'posted-content',
}

const DOI_PATTERN = /10\.\d{4,9}\/\S+/i

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined
  const text = value
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text || undefined
}

function findDoi(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (!value) continue
    const match = value.match(DOI_PATTERN)
    if (match) return match[0].replace(/["'<>.,;]+$/, '')
  }
  return null
}

function parseYear(value: string | undefined): number | undefined {
  const match = value?.match(/\d{4}/)
  return match ? Number(match[0]) : undefined
}

function splitName(raw: string): CrossrefAuthor {
  const value = clean(raw) ?? ''
  const comma = value.indexOf(',')
  if (comma === -1) return { name: value }
  return {
    family: value.slice(0, comma).trim(),
    given: value.slice(comma + 1).trim() || undefined,
  }
}

function buildWork(input: {
  doi: string
  title?: string
  type?: string
  authors: string[]
  journal?: string
  year?: number
  volume?: string
  issue?: string
  page?: string
  publisher?: string
  url?: string
}): CrossrefWork {
  const work: CrossrefWork = { DOI: input.doi }
  if (input.title) work.title = [input.title]
  if (input.type) work.type = input.type
  const authors = input.authors.map(splitName).filter((author) => author.family || author.name)
  if (authors.length > 0) work.author = authors
  if (input.journal) work['container-title'] = [input.journal]
  if (input.year) work.issued = { 'date-parts': [[input.year]] }
  if (input.volume) work.volume = input.volume
  if (input.issue) work.issue = input.issue
  if (input.page) work.page = input.page
  if (input.publisher) work.publisher = input.publisher
  if (input.url) work.URL = input.url
  return work
}

function makeEntry(work: CrossrefWork): LibraryEntry {
  return {
    doi: work.DOI,
    work,
    status: 'to-read',
    note: '',
    addedAt: new Date().toISOString(),
  }
}

type BibRecord = { type: string; fields: Record<string, string> }

/** Minimal BibTeX reader: enough for Zotero/Mendeley exports, not a TeX parser. */
function readBibRecords(text: string): BibRecord[] {
  const records: BibRecord[] = []
  const starts = /@(\w+)\s*\{/g
  let start: RegExpExecArray | null

  while ((start = starts.exec(text))) {
    const type = start[1].toLowerCase()
    if (type === 'comment' || type === 'preamble' || type === 'string') continue

    // Match the entry's closing brace so nested braces in titles don't end it early.
    const bodyStart = starts.lastIndex
    let depth = 1
    let index = bodyStart
    for (; index < text.length && depth > 0; index += 1) {
      if (text[index] === '{') depth += 1
      else if (text[index] === '}') depth -= 1
    }
    if (depth !== 0) break

    const body = text.slice(bodyStart, index - 1)
    records.push({ type, fields: readBibFields(body) })
  }

  return records
}

function readBibFields(body: string): Record<string, string> {
  const comma = findTopLevelComma(body)
  const fieldText = comma === -1 ? body : body.slice(comma + 1)
  const fields: Record<string, string> = {}

  for (const field of splitTopLevel(fieldText, ',')) {
    const equals = field.indexOf('=')
    if (equals === -1) continue
    const name = field.slice(0, equals).trim().toLowerCase()
    if (!name) continue
    fields[name] = stripBibValue(field.slice(equals + 1))
  }

  return fields
}

function findTopLevelComma(body: string): number {
  let depth = 0
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    else if (char === ',' && depth === 0) return index
  }
  return -1
}

function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    if (char === separator && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) parts.push(current)
  return parts
}

function stripBibValue(raw: string): string {
  let value = raw.trim()
  if (value.startsWith('{') && value.endsWith('}')) value = value.slice(1, -1)
  else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
  return value.trim()
}

function parseBibAuthors(value: string | undefined): string[] {
  if (!value) return []
  const authors: string[] = []
  let depth = 0
  let current = ''

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
    } else if (depth === 0) {
      // " and " separates authors only between (not inside) brace groups.
      const separator = value.slice(index).match(/^\s+and\s+/i)
      if (separator) {
        if (current.trim()) authors.push(current.trim())
        current = ''
        index += separator[0].length - 1
        continue
      }
    }
    current += char
  }

  if (current.trim()) authors.push(current.trim())
  return authors
}

export function parseBibtex(text: string): ImportResult {
  const entries: LibraryEntry[] = []
  let skipped = 0

  for (const record of readBibRecords(text)) {
    const { fields } = record
    const doi = findDoi(fields.doi, fields.url)
    if (!doi) {
      skipped += 1
      continue
    }

    const year = parseYear(fields.year ?? fields.date)
    const authors = parseBibAuthors(fields.author)
    const page = fields.pages?.replace(/\s*[-–]+\s*/, '-')

    entries.push(
      makeEntry(
        buildWork({
          doi,
          title: clean(fields.title),
          type: BIB_TYPES[record.type] ?? 'journal-article',
          authors,
          journal: clean(fields.journal ?? fields.booktitle),
          year,
          volume: clean(fields.volume),
          issue: clean(fields.number ?? fields.issue),
          page: clean(page),
          publisher: clean(fields.publisher),
          url: clean(fields.url),
        }),
      ),
    )
  }

  return { entries, skipped }
}

/** Minimal RIS reader: TY starts a record, ER ends it. */
export function parseRis(text: string): ImportResult {
  const records: Array<Record<string, string[]>> = []
  let current: Record<string, string[]> | null = null
  let lastTag = ''

  for (const line of text.split(/\r?\n/)) {
    if (/^TY\s{1,2}-/.test(line)) {
      current = {}
      lastTag = ''
    }
    if (!current) continue

    const match = line.match(/^([A-Z][A-Z0-9])\s{1,2}-\s?(.*)$/)
    if (match) {
      const [, tag, value] = match
      if (tag === 'ER') {
        records.push(current)
        current = null
        lastTag = ''
        continue
      }
      ;(current[tag] ??= []).push(value.trim())
      lastTag = tag
    } else if (lastTag && line.trim() && current[lastTag]) {
      // Wrapped (continuation) lines belong to the previous tag.
      const values = current[lastTag]
      values[values.length - 1] = `${values[values.length - 1]} ${line.trim()}`.trim()
    }
  }

  const entries: LibraryEntry[] = []
  let skipped = 0

  for (const record of records) {
    const first = (tag: string) => record[tag]?.[0]
    const doi = findDoi(first('DO'), first('UR'))
    if (!doi) {
      skipped += 1
      continue
    }

    const startPage = first('SP')
    const endPage = first('EP')
    entries.push(
      makeEntry(
        buildWork({
          doi,
          title: clean(first('TI') ?? first('T1')),
          type: RIS_TYPES[first('TY') ?? ''] ?? 'journal-article',
          authors: record.AU ?? record.A1 ?? [],
          journal: clean(first('JO') ?? first('JF') ?? first('T2')),
          year: parseYear(first('PY') ?? first('Y1')),
          volume: clean(first('VL')),
          issue: clean(first('IS')),
          page: clean(startPage && endPage ? `${startPage}-${endPage}` : startPage),
          publisher: clean(first('PB')),
          url: clean(first('UR')),
        }),
      ),
    )
  }

  return { entries, skipped }
}

/** Choose a parser from the file name or a content sniff, then normalize to library entries. */
export function parseImportFile(name: string, text: string): ImportResult {
  const lower = name.toLowerCase()
  const trimmed = text.trim()

  if (lower.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return { entries: parseLibraryJson(text), skipped: 0 }
  }
  if (lower.endsWith('.bib') || /^@\w+\s*[{(]/m.test(trimmed)) {
    return parseBibtex(text)
  }
  if (lower.endsWith('.ris') || /^TY\s{1,2}-/m.test(trimmed)) {
    return parseRis(text)
  }

  throw new Error('Use a JSON library export, a .bib file, or a .ris file.')
}
