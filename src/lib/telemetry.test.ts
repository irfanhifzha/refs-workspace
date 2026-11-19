import { beforeEach, describe, expect, it } from 'vitest'
import { clearErrorLog, getErrorLog, recordError } from './telemetry'

beforeEach(() => {
  clearErrorLog()
})

describe('telemetry', () => {
  it('records a message and keeps the newest first', () => {
    recordError('first failure', { kind: 'error' })
    recordError(new Error('second failure'), { kind: 'rejection' })

    const log = getErrorLog()
    expect(log).toHaveLength(2)
    expect(log[0].message).toBe('second failure')
    expect(log[0].kind).toBe('rejection')
    expect(log[1].message).toBe('first failure')
  })

  it('persists to localStorage and clears on request', () => {
    recordError('persisted')
    expect(localStorage.getItem('refs-workspace:error-log:v1')).toContain('persisted')

    clearErrorLog()
    expect(getErrorLog()).toEqual([])
    expect(localStorage.getItem('refs-workspace:error-log:v1')).toBeNull()
  })
})
