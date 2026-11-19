/**
 * One-at-a-time request queue for Crossref.
 *
 * Spacing starts conservative (3/sec with a polite-pool `mailto`, 1/sec without) and then follows
 * whatever `x-rate-limit-limit` / `x-rate-limit-interval` the API reports. A 429 blocks *new*
 * requests until `Retry-After` passes; the failed request is not retried automatically, so a person
 * still decides when to try again.
 */

const MAILTO = (import.meta.env.VITE_CROSSREF_MAILTO ?? '').trim()

const DEFAULT_INTERVAL_MS = MAILTO ? 340 : 1000
const MIN_INTERVAL_MS = 100
const MAX_INTERVAL_MS = 2000
const DEFAULT_RETRY_AFTER_MS = 5000

let intervalMs = DEFAULT_INTERVAL_MS
let nextAllowedAt = 0
let blockedUntil = 0
let chain: Promise<unknown> = Promise.resolve()

export function abortError(): DOMException {
  return new DOMException('The request was aborted.', 'AbortError')
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    if (signal?.aborted) return Promise.reject(abortError())
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort() {
      clearTimeout(timer)
      reject(abortError())
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Run `task` after the previous one finishes and after the rate-limit cooldown. */
export function schedule<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const run = async (): Promise<T> => {
    if (signal?.aborted) throw abortError()

    const wait = Math.max(0, nextAllowedAt - Date.now(), blockedUntil - Date.now())
    await delay(wait, signal)

    nextAllowedAt = Date.now() + intervalMs
    return task()
  }

  // Chain even after a failure, so one bad request doesn't wedge the queue.
  const result = chain.then(run, run)
  chain = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

function clamp(value: number): number {
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.round(value)))
}

/** `1s`, `500ms`, or a bare number of seconds. */
export function parseInterval(value: string | null): number | null {
  if (!value) return null
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s)?$/i)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return null
  return match[2]?.toLowerCase() === 'ms' ? amount : amount * 1000
}

/** `Retry-After` in seconds, or an HTTP date. Returns milliseconds. */
export function parseRetryAfter(value: string | null): number {
  if (!value) return DEFAULT_RETRY_AFTER_MS
  const seconds = Number(value.trim())
  if (Number.isFinite(seconds) && seconds >= 0) return clampWait(seconds * 1000)

  const date = Date.parse(value)
  if (Number.isFinite(date)) return clampWait(date - Date.now())

  return DEFAULT_RETRY_AFTER_MS
}

function clampWait(ms: number): number {
  return Math.min(60_000, Math.max(0, ms))
}

/** Adapt spacing to the limits the API reports, rather than hard-coding them. */
export function noteRateLimits(headers: Headers) {
  const limit = Number(headers.get('x-rate-limit-limit'))
  const window = parseInterval(headers.get('x-rate-limit-interval'))
  if (!Number.isFinite(limit) || limit <= 0 || window === null) return

  intervalMs = clamp(window / limit)
}

/** A 429 pauses new requests; the caller reports the failure and lets the user retry. */
export function noteRateLimitHit(retryAfter: string | null): number {
  const wait = parseRetryAfter(retryAfter)
  blockedUntil = Math.max(blockedUntil, Date.now() + wait)
  return wait
}

export function rateLimitIntervalMs(): number {
  return intervalMs
}

/** Exposed for tests so suites don't inherit timers from each other. */
export function resetQueue() {
  intervalMs = DEFAULT_INTERVAL_MS
  nextAllowedAt = 0
  blockedUntil = 0
  chain = Promise.resolve()
}
