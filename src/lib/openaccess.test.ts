import { describe, expect, it } from 'vitest'
import { crossrefPdfUrl } from './openaccess'

describe('crossrefPdfUrl', () => {
  it('finds a deposited PDF link', () => {
    const work = {
      DOI: '10.1234/x',
      link: [
        { URL: 'https://example.org/landing', 'content-type': 'text/html' },
        { URL: 'https://example.org/paper.pdf', 'content-type': 'application/pdf' },
      ],
    }
    expect(crossrefPdfUrl(work)).toBe('https://example.org/paper.pdf')
  })

  it('returns null when no PDF is deposited', () => {
    expect(crossrefPdfUrl({ DOI: '10.1234/x' })).toBeNull()
    expect(
      crossrefPdfUrl({
        DOI: '10.1234/x',
        link: [{ URL: 'https://example.org/landing', 'content-type': 'text/html' }],
      }),
    ).toBeNull()
  })
})
