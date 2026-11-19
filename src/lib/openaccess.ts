import type { CrossrefWork } from './crossref'
import { schedule } from './queue'

const EMAIL = (
  import.meta.env.VITE_UNPAYWALL_EMAIL ??
  import.meta.env.VITE_CROSSREF_MAILTO ??
  ''
).trim()

export type OpenAccessResult = {
  pdfUrl: string | null
  landingUrl: string | null
  isOa: boolean
}

type UnpaywallResponse = {
  is_oa?: boolean
  best_oa_location?: {
    url?: string
    url_for_pdf?: string
  } | null
}

export function hasOpenAccessLookup(): boolean {
  return Boolean(EMAIL)
}

/** A PDF link already deposited with Crossref costs no extra request. */
export function crossrefPdfUrl(work: CrossrefWork): string | null {
  const link = work.link?.find(
    (entry) => entry.URL && /pdf/i.test(entry['content-type'] ?? ''),
  )
  return link?.URL ?? null
}

const cache = new Map<string, OpenAccessResult>()

/** One opt-in Unpaywall request per DOI; the result (including "none") stays cached. */
export async function findOpenAccess(
  doi: string,
  signal?: AbortSignal,
): Promise<OpenAccessResult> {
  const key = doi.toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  if (!EMAIL) {
    throw new Error('Set VITE_UNPAYWALL_EMAIL to look up open-access copies.')
  }

  const params = new URLSearchParams({ email: EMAIL })
  const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?${params.toString()}`

  let response: Response
  try {
    response = await schedule(
      () => fetch(url, { signal, headers: { Accept: 'application/json' } }),
      signal,
    )
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') throw error
    throw new Error('Could not reach Unpaywall. Check your connection and try again.')
  }

  if (response.status === 404) {
    const empty: OpenAccessResult = { pdfUrl: null, landingUrl: null, isOa: false }
    cache.set(key, empty)
    return empty
  }
  if (!response.ok) {
    throw new Error(`Unpaywall returned an error (${response.status}).`)
  }

  const data = (await response.json()) as UnpaywallResponse
  const result: OpenAccessResult = {
    pdfUrl: data.best_oa_location?.url_for_pdf ?? null,
    landingUrl: data.best_oa_location?.url ?? null,
    isOa: Boolean(data.is_oa),
  }
  cache.set(key, result)
  return result
}
