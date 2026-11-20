import { mapsUrl } from './lib/address'
import { v } from 'convex/values'
import { query } from './_generated/server'
import { cashStatus, orderStatus, paymentMethod, paymentStatus } from './lib/validators'
import { currentSeller } from './model/auth'
import { ACTIVE_STATUSES, itemsSummary, orderLabel } from './model/orders'

const orderRow = v.object({
  _id: v.id('orders'),
  label: v.string(),
  createdAt: v.number(),
  customerPhone: v.string(),
  customerName: v.optional(v.string()),
  itemsSummary: v.string(),
  totalPesewas: v.number(),
  status: orderStatus,
  paymentStatus: paymentStatus,
  paymentMethod: v.optional(paymentMethod),
})

/** Newest first. `active` = everything still in progress; drafts are never listed. */
export const list = query({
  args: { filter: v.union(v.literal('active'), v.literal('delivered'), v.literal('all')) },
  returns: v.array(orderRow),
  handler: async (ctx, { filter }) => {
    const seller = await currentSeller(ctx)
    if (seller === null) return []

    const orders = await ctx.db
      .query('orders')
      .withIndex('by_seller_and_created', (q) => q.eq('sellerId', seller._id))
      .order('desc')
      .take(200)

    const visible = orders.filter((o) => {
      if (filter === 'active') return o.status === 'draft' || ACTIVE_STATUSES.has(o.status)
      if (filter === 'delivered') return o.status === 'delivered'
      return true
    })

    return await Promise.all(
      visible.map(async (o) => {
        const customer = await ctx.db.get(o.customerId)
        return {
          _id: o._id,
          label: orderLabel(o),
          createdAt: o.createdAt,
          customerPhone: customer?.phone ?? '',
          customerName: customer?.name,
          itemsSummary: itemsSummary(o.items),
          totalPesewas: o.totalPesewas,
          status: o.status,
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
        }
      }),
    )
  },
})

const detailView = v.object({
  _id: v.id('orders'),
  label: v.string(),
  createdAt: v.number(),
  status: orderStatus,
  paymentStatus: paymentStatus,
  items: v.array(v.object({ name: v.string(), unitPricePesewas: v.number(), qty: v.number() })),
  subtotalPesewas: v.number(),
  feePesewas: v.number(),
  totalPesewas: v.number(),
  deliveryFeePesewas: v.number(),
  paymentMethod: v.optional(paymentMethod),
  cashDuePesewas: v.number(),
  cashStatus: v.optional(cashStatus),
  address: v.optional(v.string()),
  digitalAddress: v.optional(v.string()),
  hasPin: v.boolean(),
  outsideDeliveryArea: v.boolean(),
  recipient: v.union(v.null(), v.object({ name: v.optional(v.string()), phone: v.optional(v.string()) })),
  mapsUrl: v.optional(v.string()),
  paymentUrl: v.optional(v.string()),
  customer: v.object({ name: v.optional(v.string()), phone: v.string() }),
  timeline: v.array(v.object({ status: orderStatus, at: v.number(), note: v.optional(v.string()) })),
  payment: v.union(v.null(), v.object({ reference: v.string(), status: paymentStatus, amountPesewas: v.number() })),
  delivery: v.union(
    v.null(),
    v.object({
      riderName: v.string(),
      riderPhone: v.string(),
      status: v.union(v.literal('dispatched'), v.literal('delivered'), v.literal('failed'), v.literal('returned')),
      notes: v.optional(v.string()),
      dispatchedAt: v.optional(v.number()),
      riderFeePesewas: v.optional(v.number()),
      riderFeeFromCash: v.boolean(),
    }),
  ),
  attention: v.array(v.object({ _id: v.id('attentionItems'), summary: v.string(), createdAt: v.number() })),
})

/** One order with everything the order page shows. Null if it isn't the caller's. */
export const get = query({
  args: { orderId: v.id('orders') },
  returns: v.union(detailView, v.null()),
  handler: async (ctx, { orderId }) => {
    const seller = await currentSeller(ctx)
    const order = await ctx.db.get(orderId)
    if (seller === null || order === null || order.sellerId !== seller._id) return null
    const [customer, delivery, payments, attention] = await Promise.all([
      ctx.db.get(order.customerId),
      order.deliveryId ? ctx.db.get(order.deliveryId) : null,
      ctx.db
        .query('payments')
        .withIndex('by_order', (q) => q.eq('orderId', orderId))
        .order('desc')
        .take(10),
      ctx.db
        .query('attentionItems')
        .withIndex('by_order', (q) => q.eq('orderId', orderId))
        .take(20),
    ])
    const payment = payments.find((p) => p.status === 'paid' || p.status === 'refunded') ?? payments[0] ?? null
    return {
      _id: order._id,
      label: orderLabel(order),
      createdAt: order.createdAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      items: order.items.map(({ name, unitPricePesewas, qty }) => ({ name, unitPricePesewas, qty })),
      subtotalPesewas: order.subtotalPesewas,
      feePesewas: order.feePesewas,
      totalPesewas: order.totalPesewas,
      address: order.address,
      deliveryFeePesewas: order.deliveryFeePesewas ?? 0,
      paymentMethod: order.paymentMethod,
      cashDuePesewas: order.cashDuePesewas ?? 0,
      cashStatus: order.cashStatus,
      digitalAddress: order.digitalAddress,
      hasPin: order.location !== undefined,
      outsideDeliveryArea: order.outsideDeliveryArea === true,
      recipient: order.recipientName || order.recipientPhone ? { name: order.recipientName, phone: order.recipientPhone } : null,
      mapsUrl: mapsUrl(order),
      paymentUrl: order.status === 'awaiting_payment' ? order.paymentUrl : undefined,
      customer: { name: customer?.name, phone: customer?.phone ?? '' },
      timeline: order.timeline,
      payment: payment ? { reference: payment.reference, status: payment.status, amountPesewas: payment.amountPesewas } : null,
      delivery: delivery
        ? {
            riderName: delivery.riderName,
            riderPhone: delivery.riderPhone,
            status: delivery.status,
            notes: delivery.notes,
            dispatchedAt: delivery.dispatchedAt,
            riderFeePesewas: delivery.riderFeePesewas,
            riderFeeFromCash: delivery.riderFeeFromCash === true,
          }
        : null,
      attention: attention
        .filter((a) => !a.resolved)
        .map(({ _id, summary, createdAt }) => ({ _id, summary, createdAt })),
    }
  },
})
