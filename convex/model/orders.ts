import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export type OrderStatus = Doc<'orders'>['status']
export type PaymentStatus = Doc<'orders'>['paymentStatus']

/** Orders still in progress (shown under "Active"). Drafts are never listed. */
export const ACTIVE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'awaiting_confirmation',
  'awaiting_payment',
  'paid',
  'dispatched',
  'delivery_failed',
])

/**
 * Every allowed order status change (CLAUDE.md §5). Anything not listed is rejected.
 * A customer can still change their order while it waits for their confirmation
 * (back to draft). Cancelling is possible until the order leaves with a rider.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  draft: ['awaiting_confirmation', 'cancelled'],
  awaiting_confirmation: ['draft', 'awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['dispatched', 'cancelled'],
  dispatched: ['delivered', 'delivery_failed'],
  delivery_failed: ['dispatched', 'returned'],
  delivered: [],
  returned: [],
  cancelled: [],
}

export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  // A payment can still arrive after an order was cancelled; Stallo records what really happened.
  none: ['pending', 'paid'],
  pending: ['paid', 'failed', 'none'],
  failed: ['pending', 'paid'],
  paid: ['refunded'],
  refunded: ['paid'], // only when Paystack reports the refund failed
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to)
}

export function canChangePayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to)
}

/**
 * The only way an order's status changes. Rejects illegal moves and records
 * each change on the timeline.
 */
export async function transition(
  ctx: MutationCtx,
  order: Doc<'orders'>,
  to: OrderStatus,
  extra: Partial<Omit<Doc<'orders'>, '_id' | '_creationTime' | 'status' | 'timeline'>> & { note?: string } = {},
): Promise<Doc<'orders'>> {
  if (!canTransition(order.status, to)) {
    throw new ConvexError(`This order is ${order.status.replace(/_/g, ' ')} and can't be moved to ${to.replace(/_/g, ' ')}.`)
  }
  const { note, ...fields } = extra
  if (fields.paymentStatus !== undefined && fields.paymentStatus !== order.paymentStatus) {
    if (!canChangePayment(order.paymentStatus, fields.paymentStatus)) {
      throw new ConvexError(`Payment can't go from ${order.paymentStatus} to ${fields.paymentStatus}.`)
    }
  }
  const timeline = [...order.timeline, { status: to, at: Date.now(), ...(note ? { note } : {}) }]
  await ctx.db.patch(order._id, { ...fields, status: to, timeline })
  return { ...order, ...fields, status: to, timeline }
}

/** Changes only the payment status, enforcing the payment rules. */
export async function setPaymentStatus(ctx: MutationCtx, order: Doc<'orders'>, to: PaymentStatus): Promise<void> {
  if (order.paymentStatus === to) return
  if (!canChangePayment(order.paymentStatus, to)) {
    throw new ConvexError(`Payment can't go from ${order.paymentStatus} to ${to}.`)
  }
  await ctx.db.patch(order._id, { paymentStatus: to })
}

export function itemsSummary(items: Doc<'orders'>['items']): string {
  return items.map((i) => `${i.qty} × ${i.name}`).join(', ')
}

export function subtotalOf(items: Doc<'orders'>['items']): number {
  return items.reduce((sum, i) => sum + i.unitPricePesewas * i.qty, 0)
}

/** Gives the seller's next order number (1001, 1002, …). */
export async function nextOrderNumber(ctx: MutationCtx, sellerId: Id<'sellers'>): Promise<number> {
  const seller = await ctx.db.get(sellerId)
  const number = seller?.nextOrderNumber ?? 1001
  await ctx.db.patch(sellerId, { nextOrderNumber: number + 1 })
  return number
}

export function orderLabel(order: Pick<Doc<'orders'>, 'number' | '_id'>): string {
  return order.number !== undefined ? `#${order.number}` : `#${order._id.slice(-5).toUpperCase()}`
}
