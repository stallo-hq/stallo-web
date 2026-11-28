/**
 * When sellers get their money. Paystack marks an order paid at once but pays the seller's share
 * out on its settlement schedule, so every screen says the same thing and nobody expects it instantly.
 */
export const PAYOUT_TIMING = 'usually the next business day'

export const PAYOUT_NOTE = `Paystack pays your share to your MoMo or bank account, ${PAYOUT_TIMING}, not the moment the customer pays.`
