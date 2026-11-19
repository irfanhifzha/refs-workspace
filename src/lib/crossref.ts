import { toPlainText } from './jats'
import { noteRateLimitHit, noteRateLimits, schedule } from './queue'

const BASE_URL = 'https://api.crossref.org'
const MAILTO = (import.meta.env.VITE_CROSSREF_MAILTO ?? '').trim()

export const PAGE_SIZE = 20

export const SEARCH_SORTS = ['relevance', 'newest', 'oldest', 'cited'] as const
export type SearchSort = (typeof SEARCH_SORTS)[number]

export const SEARCH_TYPES = [
  'journal-article',
  'book-chapter',
  'proceedings-article',
  'posted-content',
  'book',
  'dataset',
  'report',
  'dissertation',
] as const
export type SearchType = (typeof SEARCH_TYPES)[number]

export type SearchFilters = {
  from?: string
  to?: string
  type?: SearchType
  abstract?: boolean
  references?: boolean
  fullText?: boolean
  sort: SearchSort
}

export type SearchOptions = {
  from?: string
  to?: string
  type?: SearchType
  abstract?: boolean
  references?: boolean
  fullText?: boolean
  sort?: SearchSort
}

const LIST_SELECT = [
  'DOI',
  'title',
  'author',
  'container-title',
  'issued',
  'published',
  'type',
  'publisher',
  'volume',
  'issue',
  'page',
  'URL',
  'is-referenced-by-count',
  'references-count',
  'subject',
].join(',')

export type CrossrefAuthor = {
  given?: string
  family?: string
  name?: string
}

export type CrossrefDate = {
  'date-parts'?: number[][]
}

export type CrossrefReference = {
  key?: string
  DOI?: string
  'article-title'?: string
  'journal-title'?: string
  author?: string
  year?: string
  volume?: string
  'first-page'?: string
  unstructured?: string
}

export type CrossrefWork = {
  DOI: string
  title?: string[]
  subtitle?: string[]
  author?: CrossrefAuthor[]
  editor?: CrossrefAuthor[]
  'container-title'?: string[]
  'short-container-title'?: string[]
  issued?: CrossrefDate
  published?: CrossrefDate
  type?: string
  publisher?: string
  volume?: string
  issue?: string
  page?: string
  URL?: string
  abstract?: string
  subject?: string[]
  ISSN?: string[]
  'is-referenced-by-count'?: number
  'references-count'?: number
  reference?: CrossrefReference[]
}

type CrossrefListResponse = {
  message: {
    'total-results'?: number
    items?: CrossrefWork[]
  }
}

type CrossrefWorkResponse = {
  message: CrossrefWork
}

export type SearchPage = {
  items: CrossrefWork[]
  total: number
}

export class CrossrefError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CrossrefError'
    this.status = status
  }
}

const searchCache = new Map<string, SearchPage>()
const workCache = new Map<string, CrossrefWork>()
const relatedCache = new Map<string, CrossrefWork[]>()

function remember<K, V>(cache: Map<K, V>, key: K, value: V) {
  if (cache.size >= 80) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

export function errorMessage(error: unknown): string {
  if (error instanceof CrossrefError) return error.message
  if (isAbortError(error)) return 'Request cancelled.'
  return 'Something went wrong while talking to Crossref.'
}

function withMailto(params: URLSearchParams): URLSearchParams {
  if (MAILTO) params.set('mailto', MAILTO)
  return params
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  let retryAfterMs = 5000
  try {
    response = await schedule(async () => {
      const result = await fetch(`${BASE_URL}${path}`, {
        signal,
        headers: { Accept: 'application/json' },
      })
      noteRateLimits(result.headers)
      if (result.status === 429) {
        retryAfterMs = noteRateLimitHit(result.headers.get('retry-after'))
      }
      return result
    }, signal)
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new CrossrefError('Could not reach Crossref. Check your connection and try again.', 0)
  }

  if (response.status === 429) {
    const wait = Math.max(1, Math.ceil(retryAfterMs / 1000))
    throw new CrossrefError(
      `Crossref is busy right now (rate limit). New requests are paused for about ${wait}s — try again after that.`,
      429,
    )
  }
  if (!response.ok) {
    throw new CrossrefError(`Crossref returned an error (${response.status}).`, response.status)
  }

  return (await response.json()) as T
}

function cleanField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? toPlainText(value) : undefined
}

function cleanList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((item) => (typeof item === 'string' ? toPlainText(item) : ''))
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeAuthors(value: unknown): CrossrefAuthor[] | undefined {
  if (!Array.isArray(value)) return undefined
  const authors = value
    .filter(isRecord)
    .map((author) => ({
      given: cleanField(author.given),
      family: cleanField(author.family),
      name: cleanField(author.name),
    }))
    .filter((author) => author.family || author.name)
  return authors.length > 0 ? authors : undefined
}

function normalizeReference(reference: CrossrefReference): CrossrefReference {
  return {
    ...reference,
    DOI: cleanField(reference.DOI),
    key: cleanField(reference.key),
    'article-title': cleanField(reference['article-title']),
    'journal-title': cleanField(reference['journal-title']),
    author: cleanField(reference.author),
    year: cleanField(reference.year),
    volume: cleanField(reference.volume),
    'first-page': cleanField(reference['first-page']),
    unstructured: cleanField(reference.unstructured),
  }
}

/** Clean up untrusted Crossref metadata once, so components can render it directly. */
export function normalizeWork(raw: CrossrefWork): CrossrefWork {
  const references = Array.isArray(raw.reference)
    ? raw.reference.filter(isRecord).map((reference) => normalizeReference(reference as CrossrefReference))
    : undefined

  return {
    ...raw,
    title: cleanList(raw.title),
    subtitle: cleanList(raw.subtitle),
    author: normalizeAuthors(raw.author),
    editor: normalizeAuthors(raw.editor),
    'container-title': cleanList(raw['container-title']),
    'short-container-title': cleanList(raw['short-container-title']),
    abstract: cleanField(raw.abstract),
    subject: cleanList(raw.subject),
    reference: references && references.length > 0 ? references : undefined,
  }
}

function buildSearchParams(
  query: string,
  offset: number,
  options: SearchOptions,
): URLSearchParams {
  const params = new URLSearchParams({
    'query.bibliographic': query.trim(),
    rows: String(PAGE_SIZE),
    offset: String(offset),
    select: LIST_SELECT,
  })

  const filters: string[] = []
  if (options.from) filters.push(`from-pub-date:${options.from}-01-01`)
  if (options.to) filters.push(`until-pub-date:${options.to}-12-31`)
  if (options.type) filters.push(`type:${options.type}`)
  if (options.abstract) filters.push('has-abstract:true')
  if (options.references) filters.push('has-references:true')
  if (options.fullText) filters.push('has-full-text:true')
  if (filters.length > 0) params.set('filter', filters.join(','))

  if (options.sort === 'newest') {
    params.set('sort', 'published')
    params.set('order', 'desc')
  } else if (options.sort === 'oldest') {
    params.set('sort', 'published')
    params.set('order', 'asc')
  } else if (options.sort === 'cited') {
    params.set('sort', 'is-referenced-by-count')
    params.set('order', 'desc')
  }

  return params
}

export async function searchWorks(
  query: string,
  offset: number,
  options: SearchOptions = {},
  signal?: AbortSignal,
): Promise<SearchPage> {
  const params = buildSearchParams(query, offset, options)
  const key = params.toString()
  const cached = searchCache.get(key)
  if (cached) return cached

  const data = await request<CrossrefListResponse>(
    `/works?${withMailto(params).toString()}`,
    signal,
  )
  const page: SearchPage = {
    items: (data.message.items ?? []).map(normalizeWork),
    total: data.message['total-results'] ?? 0,
  }
  remember(searchCache, key, page)
  return page
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'using',
  'this',
  'that',
  'study',
  'paper',
])

function titleTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  )
}

function sharedCount(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const value of left) if (right.has(value)) count += 1
  return count
}

/**
 * Approximate related papers with one title/author search, reranked locally by shared subject terms,
 * title overlap, and whether the reference lists connect. Opt-in and cached by DOI, so it stays
 * within the one-request budget.
 */
export async function findRelatedWorks(
  work: CrossrefWork,
  signal?: AbortSignal,
): Promise<CrossrefWork[]> {
  const key = work.DOI.toLowerCase()
  const cached = relatedCache.get(key)
  if (cached) return cached

  const title = work.title?.[0] ?? work.subtitle?.[0]
  if (!title) {
    remember(relatedCache, key, [])
    return []
  }

  const author = work.author?.[0]?.family
  const query = [title, author].filter(Boolean).join(' ').slice(0, 240)
  const params = withMailto(
    new URLSearchParams({
      'query.bibliographic': query,
      rows: '20',
      select: LIST_SELECT,
    }),
  )

  const subjects = new Set((work.subject ?? []).map((subject) => subject.toLowerCase().trim()))
  const tokens = titleTokens(title)
  const referenceDois = new Set(
    (work.reference ?? [])
      .map((reference) => reference.DOI?.toLowerCase())
      .filter((doi): doi is string => Boolean(doi)),
  )
  const families = new Set(
    (work.author ?? [])
      .map((person) => person.family?.toLowerCase())
      .filter((family): family is string => Boolean(family)),
  )

  const data = await request<CrossrefListResponse>(`/works?${params.toString()}`, signal)

  const items = (data.message.items ?? [])
    .map(normalizeWork)
    .filter((item) => item.DOI.toLowerCase() !== key && item.title?.[0])
    .map((item) => {
      const itemSubjects = (item.subject ?? []).map((subject) => subject.toLowerCase().trim())
      let score = itemSubjects.filter((subject) => subjects.has(subject)).length * 4
      score += sharedCount(tokens, titleTokens(item.title?.[0] ?? ''))
      if (referenceDois.has(item.DOI.toLowerCase())) score += 3
      if (
        item.author?.some(
          (person) => person.family && families.has(person.family.toLowerCase()),
        )
      ) {
        score += 1
      }
      return { item, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry) => entry.item)

  remember(relatedCache, key, items)
  return items
}

export function getCachedWork(doi: string): CrossrefWork | undefined {
  return workCache.get(doi.toLowerCase())
}

export async function getWork(doi: string, signal?: AbortSignal): Promise<CrossrefWork> {
  const key = doi.toLowerCase()
  const cached = workCache.get(key)
  if (cached) return cached

  const query = withMailto(new URLSearchParams()).toString()
  const suffix = query ? `?${query}` : ''
  const data = await request<CrossrefWorkResponse>(
    `/works/${encodeURIComponent(doi)}${suffix}`,
    signal,
  )
  const work = normalizeWork(data.message)
  remember(workCache, key, work)
  return work
}

export function workTitle(work: CrossrefWork): string {
  return work.title?.[0] ?? work.subtitle?.[0] ?? `Untitled record (${work.DOI})`
}

export function parseYear(work: CrossrefWork): string | null {
  const parts = work.issued?.['date-parts']?.[0] ?? work.published?.['date-parts']?.[0]
  const year = parts?.[0]
  return typeof year === 'number' && year > 0 ? String(year) : null
}

export function authorLine(work: CrossrefWork, short = false): string {
  const authors = (work.author ?? [])
    .map((author) => author.family ?? author.name ?? '')
    .filter(Boolean)
  if (short && authors.length > 3) return `${authors.slice(0, 3).join(', ')} et al.`
  return authors.join(', ')
}

export function typeLabel(type?: string): string | null {
  if (!type) return null
  const label = type.replace(/-/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function doiUrl(doi: string): string {
  return `https://doi.org/${doi}`
}

const DOI_PATTERN = /10\.\d{4,9}\/\S+/i

/** Drop punctuation a DOI picked up from a URL, quoted JSON, or a sentence. */
function trimDoi(value: string): string {
  return value.trim().replace(/["'<>.,;]+$/, '')
}

function findDoi(value: unknown): string | null {
  if (typeof value === 'string') {
    const match = value.match(DOI_PATTERN)
    return match ? trimDoi(match[0]) : null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const doi = findDoi(item)
      if (doi) return doi
    }
    return null
  }
  if (isRecord(value)) {
    if (typeof value.DOI === 'string') return trimDoi(value.DOI)
    if (typeof value.doi === 'string') return trimDoi(value.doi)
    if ('message' in value) return findDoi(value.message)
    if ('items' in value) return findDoi(value.items)
  }
  return null
}

/**
 * Recognize the fastest path into the detail view: a bare DOI, a doi.org URL, or a pasted Crossref
 * JSON blob. Returns null when the input should be treated as a normal search query.
 */
export function parseDoiInput(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      const doi = findDoi(JSON.parse(value))
      if (doi) return doi
    } catch {
      // Not JSON after all; fall through to the DOI pattern.
    }
  }

  const match = value.match(DOI_PATTERN)
  return match ? trimDoi(match[0]) : null
}
