import { toPlainText } from './jats'

const BASE_URL = 'https://api.crossref.org'
const MAILTO = (import.meta.env.VITE_CROSSREF_MAILTO ?? '').trim()

export const PAGE_SIZE = 20

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

function remember<K, V>(cache: Map<K, V>, key: K, value: V) {
  if (cache.size >= 80) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
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
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new CrossrefError('Could not reach Crossref. Check your connection and try again.', 0)
  }

  if (response.status === 429) {
    throw new CrossrefError(
      'Crossref is busy right now (rate limit). Wait a few seconds and try again.',
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
    reference: references && references.length > 0 ? references : undefined,
  }
}

export async function searchWorks(
  query: string,
  offset: number,
  signal?: AbortSignal,
): Promise<SearchPage> {
  const key = `${query.trim().toLowerCase()}|${offset}`
  const cached = searchCache.get(key)
  if (cached) return cached

  const params = withMailto(
    new URLSearchParams({
      'query.bibliographic': query.trim(),
      rows: String(PAGE_SIZE),
      offset: String(offset),
      select: LIST_SELECT,
    }),
  )

  const data = await request<CrossrefListResponse>(`/works?${params.toString()}`, signal)
  const page: SearchPage = {
    items: (data.message.items ?? []).map(normalizeWork),
    total: data.message['total-results'] ?? 0,
  }
  remember(searchCache, key, page)
  return page
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
