import { describe, expect, it } from 'vitest'
import { decide, sanitizeMatch } from './vision'

const ids = new Set(['a', 'b', 'c', 'd'])
const match = (matches: { product_id: string; confidence: number }[]) => ({ description: 'x', text_in_image: null, matches })

describe('picture matches', () => {
  it('keeps only known products, once each, best first, at most 3', () => {
    const out = sanitizeMatch(
      match([
        { product_id: 'b', confidence: 0.4 },
        { product_id: 'zzz', confidence: 0.99 },
        { product_id: 'a', confidence: 2 },
        { product_id: 'b', confidence: 0.3 },
        { product_id: 'c', confidence: 0.2 },
        { product_id: 'd', confidence: 0.1 },
      ]),
      ids,
    )
    expect(out.matches).toEqual([
      { product_id: 'a', confidence: 1 },
      { product_id: 'b', confidence: 0.4 },
      { product_id: 'c', confidence: 0.2 },
    ])
  })

  it('adds only a clear winner to the basket', () => {
    expect(decide(match([{ product_id: 'a', confidence: 0.9 }]))).toEqual({ kind: 'match', productId: 'a' })
    expect(decide(match([{ product_id: 'a', confidence: 0.9 }, { product_id: 'b', confidence: 0.8 }]))).toEqual({
      kind: 'choose',
      productIds: ['a', 'b'],
    })
    expect(decide(match([{ product_id: 'a', confidence: 0.5 }, { product_id: 'b', confidence: 0.3 }]))).toEqual({
      kind: 'choose',
      productIds: ['a'],
    })
    expect(decide(match([{ product_id: 'a', confidence: 0.2 }]))).toEqual({ kind: 'none' })
    expect(decide(match([]))).toEqual({ kind: 'none' })
  })
})
