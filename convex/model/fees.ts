/**
 * Stallo's per-order fee. Configured only through Convex environment variables
 * so it can change without a code change:
 *   PLATFORM_FEE_PERCENT        e.g. "2.5"  (percent of the order subtotal)
 *   PLATFORM_FEE_FLAT_PESEWAS   e.g. "50"   (added per order)
 * Unset means zero.
 */
export type FeeConfig = { percent: number; flatPesewas: number }

function readNumber(name: string): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return 0
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`)
  return value
}

export function feeConfig(): FeeConfig {
  return {
    percent: readNumber('PLATFORM_FEE_PERCENT'),
    flatPesewas: Math.round(readNumber('PLATFORM_FEE_FLAT_PESEWAS')),
  }
}

/** Fee in pesewas for an order subtotal, rounded to the nearest pesewa and never more than the subtotal. */
export function calculateFee(subtotalPesewas: number, config: FeeConfig = feeConfig()): number {
  const fee = Math.round((subtotalPesewas * config.percent) / 100) + config.flatPesewas
  return Math.min(fee, subtotalPesewas)
}
