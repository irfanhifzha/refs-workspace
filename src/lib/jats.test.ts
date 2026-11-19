import { describe, expect, it } from 'vitest'
import { toPlainText } from './jats'

describe('toPlainText', () => {
  it('returns tag-free text unchanged', () => {
    expect(toPlainText('  Plain text.  ')).toBe('Plain text.')
  })

  it('strips JATS tags and collapses whitespace', () => {
    expect(toPlainText('<jats:p>Hello <jats:i>world</jats:i>.</jats:p>')).toBe('Hello world.')
  })

  it('decodes entities inside markup', () => {
    expect(toPlainText('<p>Bread &amp; butter</p>')).toBe('Bread & butter')
  })
})
