import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculateFee, cashAllowed, feeConfig, plannedCharge, sellerFeeConfig } from './fees'

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

describe('fee cap', () => {
  it('never takes more than the cap per order', () => {
    expect(calculateFee(200_000, { percent: 1.5, flatPesewas: 0, capPesewas: 1500 })).toBe(1500) // 1.5% of 2,000 = 30, capped at 15
    expect(calculateFee(50_000, { percent: 1.5, flatPesewas: 0, capPesewas: 1500 })).toBe(750)
  })

  it('reads the cap from the environment', () => {
    vi.stubEnv('PLATFORM_FEE_PERCENT', '1.5')
    vi.stubEnv('PLATFORM_FEE_CAP_PESEWAS', '1500')
    expect(feeConfig()).toMatchObject({ percent: 1.5, capPesewas: 1500 })
    vi.stubEnv('PLATFORM_FEE_CAP_PESEWAS', '')
    expect(feeConfig().capPesewas).toBeUndefined()
    vi.unstubAllEnvs()
  })
})

describe('plannedCharge', () => {
  it('takes the fee plus what is owed, up to half the payment', () => {
    expect(plannedCharge(10_000, 150, 0)).toBe(150)
    expect(plannedCharge(10_000, 150, 400)).toBe(550)
    expect(plannedCharge(1_000, 150, 4_000)).toBe(500)
  })

  it('uses a credit to lower the charge, never below zero', () => {
    expect(plannedCharge(10_000, 150, -100)).toBe(50)
    expect(plannedCharge(10_000, 150, -500)).toBe(0)
  })
})

describe('cashAllowed', () => {
  it('needs the seller to accept cash and not owe too much', () => {
    expect(cashAllowed({})).toBe(false)
    expect(cashAllowed({ acceptsCash: true })).toBe(true)
    expect(cashAllowed({ acceptsCash: true, feeBalancePesewas: 4_999 })).toBe(true)
    expect(cashAllowed({ acceptsCash: true, feeBalancePesewas: 5_000 })).toBe(false)
  })
})
