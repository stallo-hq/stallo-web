import { ConvexError } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { raiseAttention } from './attention'
import { copy } from './copy'
import { adjustFeeBalance } from './fulfilment'
import { sha256 } from './crypto'
import { formatCedis } from '../lib/money'
import { orderLabel, transition } from './orders'
import { queueMessage } from './outbound'

export const PIN_LENGTH = 4
export const MAX_PIN_ATTEMPTS = 5

/** The PIN is stored only as a hash, salted with the order id. */
export async function hashPin(orderId: string, pin: string): Promise<string> {
  return await sha256(`stallo-pin:${orderId}:${pin}`)
}

export function isPinShaped(value: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(value)
}

async function load(ctx: MutationCtx, delivery: Doc<'deliveries'>) {
  const order = await ctx.db.get(delivery.orderId)
  if (order === null) throw new ConvexError('Order not found')
  const seller = await ctx.db.get(order.sellerId)
  const customer = await ctx.db.get(order.customerId)
  if (seller === null || customer === null) throw new ConvexError('Order not found')
  return { order, seller, customer }
}

export type PinResult = { ok: true } | { ok: false; attemptsLeft: number; reason: 'wrong' | 'locked' | 'closed' }

/**
 * Checks the customer's delivery PIN. The right PIN marks the order delivered.
 * After MAX_PIN_ATTEMPTS wrong tries the delivery is locked and the seller is told.
 */
export async function checkPin(ctx: MutationCtx, delivery: Doc<'deliveries'>, pin: string): Promise<PinResult> {
  if (delivery.status !== 'dispatched') return { ok: false, attemptsLeft: 0, reason: 'closed' }
  if (delivery.attempts >= MAX_PIN_ATTEMPTS) return { ok: false, attemptsLeft: 0, reason: 'locked' }

  if ((await hashPin(delivery.orderId, pin.trim())) !== delivery.pinHash) {
    const attempts = delivery.attempts + 1
    await ctx.db.patch(delivery._id, { attempts })
    const attemptsLeft = MAX_PIN_ATTEMPTS - attempts
    if (attemptsLeft === 0) {
      const { order } = await load(ctx, delivery)
      await raiseAttention(ctx, {
        sellerId: order.sellerId,
        type: 'delivery_failed',
        orderId: order._id,
        summary: `Too many wrong delivery codes for order ${orderLabel(order)}. Call the rider and the customer.`,
        notify: true,
      })
    }
    return { ok: false, attemptsLeft, reason: attemptsLeft === 0 ? 'locked' : 'wrong' }
  }

  const { order, seller, customer } = await load(ctx, delivery)
  await ctx.db.patch(delivery._id, { status: 'delivered', closedAt: Date.now() })
  const cash = order.paymentMethod === 'cash'
  await transition(ctx, order, 'delivered', {
    note: cash
      ? `Delivery code confirmed by ${delivery.riderName}; ${formatCedis(order.cashDuePesewas ?? 0)} cash collected`
      : `Delivery code confirmed by ${delivery.riderName}`,
    ...(cash ? { cashStatus: 'with_rider' as const } : {}),
  })
  // The sale happened in cash, so Stallo's fee is owed now; later online payments cover it.
  if (cash) await adjustFeeBalance(ctx, seller, order.feePesewas)
  await queueMessage(ctx, {
    sellerId: seller._id,
    to: customer.phone,
    orderId: order._id,
    text: copy.delivered(seller.businessName, order),
    smsFallback: true,
  })
  return { ok: true }
}

/** The rider (or seller) reports the delivery didn't happen. */
export async function markDeliveryFailed(ctx: MutationCtx, delivery: Doc<'deliveries'>, reason: string, by: string) {
  if (delivery.status !== 'dispatched') throw new ConvexError('This delivery is already closed')
  const { order, seller, customer } = await load(ctx, delivery)
  const note = reason.trim().slice(0, 300) || 'No reason given'
  await ctx.db.patch(delivery._id, { status: 'failed', notes: note, closedAt: Date.now() })
  await transition(ctx, order, 'delivery_failed', { note: `${by}: ${note}` })
  await raiseAttention(ctx, {
    sellerId: seller._id,
    type: 'delivery_failed',
    orderId: order._id,
    summary: `Delivery of order ${orderLabel(order)} failed (${note}). Send it again or mark it returned.`,
    notify: true,
  })
  await queueMessage(ctx, {
    sellerId: seller._id,
    to: customer.phone,
    orderId: order._id,
    text: copy.deliveryFailed(seller.businessName, order),
    smsFallback: true,
  })
}

/** Puts an order's items back into stock (cancelled after payment, or returned). */
export async function restock(ctx: MutationCtx, order: Doc<'orders'>) {
  for (const item of order.items) {
    const product = await ctx.db.get(item.productId)
    if (product) await ctx.db.patch(product._id, { stock: product.stock + item.qty })
  }
}
