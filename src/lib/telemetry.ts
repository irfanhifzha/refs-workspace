/**
 * Telemetry-lite: client errors stay on this device. Nothing is sent anywhere.
 * Window listeners are installed only in development; boundary errors are always recorded locally.
 */

const KEY = 'refs-workspace:error-log:v1'
const MAX_ENTRIES = 50

export type ErrorLogEntry = {
  at: string
  kind: 'error' | 'rejection' | 'boundary' | 'manual'
  message: string
  detail?: string
}

let entries: ErrorLogEntry[] = read()
let installed = false

function read(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is ErrorLogEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as ErrorLogEntry).message === 'string' &&
          typeof (entry as ErrorLogEntry).at === 'string',
      )
      .slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // A full or unavailable store must not break the app.
  }
}

function describe(error: unknown): { message: string; detail?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, detail: error.stack }
  }
  if (typeof error === 'string') return { message: error }
  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: 'Unknown error' }
  }
}

export function recordError(
  error: unknown,
  context: { kind?: ErrorLogEntry['kind']; detail?: string } = {},
) {
  const { message, detail } = describe(error)
  entries = [
    {
      at: new Date().toISOString(),
      kind: context.kind ?? 'manual',
      message,
      detail: context.detail ?? detail,
    },
    ...entries,
  ].slice(0, MAX_ENTRIES)
  persist()
}

export function getErrorLog(): ErrorLogEntry[] {
  return entries
}

export function clearErrorLog() {
  entries = []
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Ignore unavailable storage.
  }
}

/** Catch uncaught errors and rejections while developing; production stays silent and local. */
export function installTelemetry() {
  if (installed || !import.meta.env.DEV) return
  installed = true

  window.addEventListener('error', (event) => {
    recordError(event.error ?? event.message, { kind: 'error' })
  })
  window.addEventListener('unhandledrejection', (event) => {
    recordError(event.reason, { kind: 'rejection' })
  })
}
