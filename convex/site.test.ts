import { afterEach, describe, expect, it, vi } from 'vitest'
import { setup } from '../test/convexTest'
import { api } from './_generated/api'
import { formatFee } from './lib/money'

afterEach(() => vi.unstubAllEnvs())

describe('site.pricing', () => {
  it('returns the fee with its cap, as shown on the website and in Settings', async () => {
    vi.stubEnv('PLATFORM_FEE_PERCENT', '1.5')
    vi.stubEnv('PLATFORM_FEE_FLAT_PESEWAS', '')
    vi.stubEnv('PLATFORM_FEE_CAP_PESEWAS', '1500')
    const pricing = await setup().query(api.site.pricing, {})
    expect(pricing).toEqual({ percent: 1.5, flatPesewas: 0, capPesewas: 1500 })
    expect(formatFee(pricing)).toBe('1.5% (at most GH₵ 15.00)')
  })
})
