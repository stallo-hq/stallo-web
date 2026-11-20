/**
 * Stallo's per-order fee. Configured only through Convex environment variables
 * so it can change without a code change:
 *   PLATFORM_FEE_PERCENT        e.g. "2.5"  (percent of the order subtotal)
 *   PLATFORM_FEE_FLAT_PESEWAS   e.g. "50"   (added per order)
 *   PLATFORM_FEE_CAP_PESEWAS    e.g. "1500" (most Stallo takes per order; unset = no cap)
 * Unset means zero. The fee is on the goods only, never on the delivery fee.
 */
export type FeeConfig = { percent: number; flatPesewas: number; capPesewas?: number }

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
    ...(readNumber('PLATFORM_FEE_CAP_PESEWAS') > 0 ? { capPesewas: Math.round(readNumber('PLATFORM_FEE_CAP_PESEWAS')) } : {}),
  }
}

/** Fee in pesewas for an order subtotal, rounded to the nearest pesewa and never more than the subtotal. */
export function calculateFee(subtotalPesewas: number, config: FeeConfig = feeConfig()): number {
  const fee = Math.round((subtotalPesewas * config.percent) / 100) + config.flatPesewas
  return Math.min(fee, subtotalPesewas, config.capPesewas ?? Infinity)
}

/** A seller's own fee when set by Stallo, otherwise the deployment default. */
export function sellerFeeConfig(seller: { feePercent?: number; feeFlatPesewas?: number }): FeeConfig {
  const base = feeConfig()
  return {
    percent: seller.feePercent ?? base.percent,
    flatPesewas: seller.feeFlatPesewas ?? base.flatPesewas,
    ...(base.capPesewas !== undefined ? { capPesewas: base.capPesewas } : {}),
  }
}

/** Stallo never takes more than this share of one online payment, so the seller always gets most of it. */
export const MAX_CHARGE_SHARE = 0.5

/** Above this balance a seller can't offer cash until online payments have covered it. */
export const CASH_BALANCE_LIMIT_PESEWAS = 5000

/**
 * How much of an online payment goes to Stallo. It's the fee due now plus any
 * fees the seller owes from cash orders (or minus a credit), never below 0 and
 * never more than half of the payment.
 */
export function plannedCharge(amountPesewas: number, feeDueNowPesewas: number, balancePesewas: number): number {
  const wanted = feeDueNowPesewas + balancePesewas
  return Math.max(0, Math.min(wanted, Math.floor(amountPesewas * MAX_CHARGE_SHARE)))
}

/** Cash on delivery is offered only when the seller allows it and doesn't owe too much. */
export function cashAllowed(seller: { acceptsCash?: boolean; feeBalancePesewas?: number }): boolean {
  return seller.acceptsCash === true && (seller.feeBalancePesewas ?? 0) < CASH_BALANCE_LIMIT_PESEWAS
}
