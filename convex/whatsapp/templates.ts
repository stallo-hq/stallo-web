/**
 * WhatsApp message templates. Outside the 24-hour customer-service window
 * WhatsApp only delivers pre-approved templates, so every message that may go
 * out late has one here. The exact wording to submit to Meta is in
 * docs/whatsapp-templates.md; the parameter order below must match it.
 *
 * Channel "seller" = sent from the seller's connected number (to customers and riders).
 * Channel "platform" = sent from Stallo's own number (to sellers).
 */

export type TemplateName = keyof typeof TEMPLATES

export const TEMPLATE_LANGUAGE = 'en'

export const TEMPLATES = {
  /** To the customer when a rider leaves. {{1}} business, {{2}} order, {{3}} rider name, {{4}} PIN */
  stallo_delivery_pin: { channel: 'seller', params: 4 },
  /** To the customer after delivery. {{1}} business, {{2}} order */
  stallo_order_delivered: { channel: 'seller', params: 2 },
  /** To the customer when delivery didn't happen. {{1}} business, {{2}} order */
  stallo_delivery_failed: { channel: 'seller', params: 2 },
  /** To the customer when the seller cancels. {{1}} business, {{2}} order */
  stallo_order_cancelled: { channel: 'seller', params: 2 },
  /** To the rider. {{1}} business, {{2}} order, {{3}} customer, {{4}} address, {{5}} link to the job page */
  stallo_rider_job: { channel: 'seller', params: 5 },
  /** To the seller when an order is paid. {{1}} order, {{2}} items, {{3}} amount */
  stallo_seller_order_paid: { channel: 'platform', params: 3 },
  /** To the seller when something needs them. {{1}} short description */
  stallo_seller_attention: { channel: 'platform', params: 1 },
  /** Daily summary to the seller. {{1}} business, {{2}} orders, {{3}} paid amount, {{4}} to deliver, {{5}} need attention */
  stallo_seller_daily_summary: { channel: 'platform', params: 5 },
} as const satisfies Record<string, { channel: 'seller' | 'platform'; params: number }>

/** Template parameters can't contain new lines, tabs or more than four spaces in a row. */
export function templateParam(value: string): string {
  return value.replace(/[\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 1000) || '-'
}
