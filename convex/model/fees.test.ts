import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculateFee, feeConfig, sellerFeeConfig } from './fees'

afterEach(() => vi.unstubAllEnvs())

describe('fees', () => {
  it('takes a percentage, rounded to the pesewa', () => {
    expect(calculateFee(10000, { percent: 2.5, flatPesewas: 0 })).toBe(250)
    expect(calculateFee(1999, { percent: 2.5, flatPesewas: 0 })).toBe(50)
    expect(calculateFee(10, { percent: 2.5, flatPesewas: 0 })).toBe(0)
  })

  it('adds a flat part', () => {
    expect(calculateFee(10000, { percent: 2, flatPesewas: 50 })).toBe(250)
  })

  it('is never more than the order', () => {
    expect(calculateFee(30, { percent: 0, flatPesewas: 50 })).toBe(30)
  })

  it('reads the deployment default and lets a seller override it', () => {
    vi.stubEnv('PLATFORM_FEE_PERCENT', '3')
    vi.stubEnv('PLATFORM_FEE_FLAT_PESEWAS', '20')
    expect(feeConfig()).toEqual({ percent: 3, flatPesewas: 20 })
    expect(sellerFeeConfig({})).toEqual({ percent: 3, flatPesewas: 20 })
    expect(sellerFeeConfig({ feePercent: 1 })).toEqual({ percent: 1, flatPesewas: 20 })
  })

  it('treats unset as zero and rejects nonsense', () => {
    vi.stubEnv('PLATFORM_FEE_PERCENT', '')
    vi.stubEnv('PLATFORM_FEE_FLAT_PESEWAS', '')
    expect(feeConfig()).toEqual({ percent: 0, flatPesewas: 0 })
    vi.stubEnv('PLATFORM_FEE_PERCENT', '-1')
    expect(() => feeConfig()).toThrow()
  })
})
