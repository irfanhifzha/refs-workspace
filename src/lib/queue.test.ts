import { beforeEach, describe, expect, it } from 'vitest'
import {
  parseInterval,
  parseRetryAfter,
  resetQueue,
  schedule,
} from './queue'

beforeEach(() => {
  resetQueue()
})

describe('parseInterval', () => {
  it('understands seconds, milliseconds, and bare numbers', () => {
    expect(parseInterval('1s')).toBe(1000)
    expect(parseInterval('250ms')).toBe(250)
    expect(parseInterval('2')).toBe(2000)
  })

  it('rejects nonsense', () => {
    expect(parseInterval(null)).toBeNull()
    expect(parseInterval('soon')).toBeNull()
    expect(parseInterval('0s')).toBeNull()
  })
})

describe('parseRetryAfter', () => {
  it('reads seconds', () => {
    expect(parseRetryAfter('7')).toBe(7000)
  })

  it('reads an HTTP date', () => {
    const target = Date.now() + 4000
    const value = new Date(target).toUTCString()
    const wait = parseRetryAfter(value)
    expect(wait).toBeGreaterThan(2500)
    expect(wait).toBeLessThanOrEqual(5000)
  })

  it('falls back when the header is missing or invalid', () => {
    expect(parseRetryAfter(null)).toBe(5000)
    expect(parseRetryAfter('later')).toBe(5000)
  })
})

describe('schedule', () => {
  it('runs tasks one at a time, in order', async () => {
    const events: string[] = []

    const first = schedule(async () => {
      events.push('first:start')
      await new Promise((resolve) => setTimeout(resolve, 5))
      events.push('first:end')
    })
    const second = schedule(async () => {
      events.push('second')
    })

    await Promise.all([first, second])
    expect(events).toEqual(['first:start', 'first:end', 'second'])
  })

  it('keeps running after a task fails', async () => {
    await expect(schedule(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    await expect(schedule(async () => 'ok')).resolves.toBe('ok')
  })

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(schedule(async () => 'never', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})
