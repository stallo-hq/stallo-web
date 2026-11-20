import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { action, internalAction, internalMutation, internalQuery } from './_generated/server'
import {
  PaystackError,
  customerEmail,
  initializePayment,
  paystackConfigured,
  refund as paystackRefund,
  verifyTransaction,
} from './integrations/paystack'
import { formatCedis } from './lib/money'
import { raiseAttention } from './model/attention'
import { assertOwned, requireSeller } from './model/auth'
import { copy } from './model/copy'
import { randomDigits } from './model/crypto'
import { restock } from './model/delivery'
import { itemsSummary, orderLabel, setPaymentStatus, transition } from './model/orders'
import { queueMessage } from './model/outbound'

// ---------------------------------------------------------------------------
// Payment links

export const linkContext = internalQuery({
  args: { orderId: v.id('orders') },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId)
    if (!order || order.status !== 'awaiting_payment') return null
    const seller = await ctx.db.get(order.sellerId)
    const customer = await ctx.db.get(order.customerId)
    if (!seller || !customer) return null
    return { order, subaccount: seller.paystackSubaccountCode ?? null, customerPhone: customer.phone }
  },
})

export const linkCreated = internalMutation({
  args: { orderId: v.id('orders'), reference: v.string(), url: v.string() },
  returns: v.null(),
  handler: async (ctx, { orderId, reference, url }) => {
    const order = await ctx.db.get(orderId)
    if (!order || order.status !== 'awaiting_payment') return null
    const seller = (await ctx.db.get(order.sellerId))!
    const customer = (await ctx.db.get(order.customerId))!
    await ctx.db.insert('payments', {
      orderId,
      sellerId: order.sellerId,
      reference,
      amountPesewas: order.totalPesewas,
      feePesewas: order.feePesewas,
      status: 'pending',
    })
    await ctx.db.patch(orderId, { paymentUrl: url })
    await queueMessage(ctx, {
      sellerId: seller._id,
      to: customer.phone,
      orderId,
      text: copy.payLink(order, url),
    })
    return null
  },
})

export const linkFailed = internalMutation({
  args: { orderId: v.id('orders'), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { orderId, reason }) => {
    const order = await ctx.db.get(orderId)
    if (!order || order.status !== 'awaiting_payment') return null
    const seller = (await ctx.db.get(order.sellerId))!
    const customer = (await ctx.db.get(order.customerId))!
    await raiseAttention(ctx, {
      sellerId: seller._id,
      type: 'payment_failed',
      orderId,
      summary: `Couldn't create a payment link for order ${orderLabel(order)}: ${reason}`,
      notify: true,
    })
    await queueMessage(ctx, { sellerId: seller._id, to: customer.phone, orderId, text: copy.payLinkDelayed(seller.businessName) })
    return null
  },
})

/** Creates the Paystack link for a confirmed order and sends it to the customer. */
export const createLink = internalAction({
  args: { orderId: v.id('orders'), attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { orderId, attempt = 0 }) => {
    const c = await ctx.runQuery(internal.payments.linkContext, { orderId })
    if (c === null) return null
    if (!paystackConfigured()) {
      await ctx.runMutation(internal.payments.linkFailed, { orderId, reason: 'payments are not set up on Stallo yet' })
      return null
    }
    if (c.subaccount === null) {
      await ctx.runMutation(internal.payments.linkFailed, {
        orderId,
        reason: 'add your payout account in Settings → Payouts, then resend the link from the order page',
      })
      return null
    }
    const reference = `STL-${c.order.number ?? 'X'}-${randomDigits(8)}`
    try {
      const result = await initializePayment({
        amountPesewas: c.order.totalPesewas,
        feePesewas: c.order.feePesewas,
        email: await customerEmail(c.customerPhone),
        reference,
        subaccount: c.subaccount,
        metadata: { orderId, sellerId: c.order.sellerId },
      })
      await ctx.runMutation(internal.payments.linkCreated, { orderId, reference, url: result.authorization_url })
    } catch (error) {
      if (error instanceof PaystackError && error.retryable && attempt < 3) {
        await ctx.scheduler.runAfter(5000 * 2 ** attempt, internal.payments.createLink, { orderId, attempt: attempt + 1 })
        return null
      }
      await ctx.runMutation(internal.payments.linkFailed, { orderId, reason: error instanceof Error ? error.message : String(error) })
    }
    return null
  },
})

/** Seller: try sending the payment link again (e.g. after setting up payouts). */
export const resendLink = action({
  args: { orderId: v.id('orders') },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    await ctx.runQuery(internal.payments.assertCanResend, { orderId })
    await ctx.runAction(internal.payments.createLink, { orderId })
    return null
  },
})

export const assertCanResend = internalQuery({
  args: { orderId: v.id('orders') },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const seller = await requireSeller(ctx)
    const order = assertOwned(await ctx.db.get(orderId), seller, 'Order')
    if (order.status !== 'awaiting_payment') throw new ConvexError('This order is not waiting for payment.')
    return null
  },
})

// ---------------------------------------------------------------------------
// Paystack webhook events

export const byReference = internalQuery({
  args: { reference: v.string() },
  handler: async (ctx, { reference }) =>
    await ctx.db
      .query('payments')
      .withIndex('by_reference', (q) => q.eq('reference', reference))
      .unique(),
})

/** charge.success: re-check with Paystack's API before trusting the event, then mark paid. */
export const handleChargeSuccess = internalAction({
  args: { reference: v.string() },
  returns: v.null(),
  handler: async (ctx, { reference }) => {
    const payment = await ctx.runQuery(internal.payments.byReference, { reference })
    if (payment === null || payment.status === 'paid' || payment.status === 'refunded') return null
    const tx = await verifyTransaction(reference)
    if (tx.status === 'success' && tx.amount === payment.amountPesewas && tx.currency === 'GHS') {
      await ctx.runMutation(internal.payments.markPaid, { reference })
    } else if (tx.status === 'failed' || tx.status === 'abandoned') {
      await ctx.runMutation(internal.payments.markFailed, { reference, reason: `Paystack status: ${tx.status}` })
    } else if (tx.status === 'success') {
      await ctx.runMutation(internal.payments.markFailed, {
        reference,
        reason: `Amount mismatch: expected ${payment.amountPesewas}, Paystack reported ${tx.amount} ${tx.currency}`,
      })
    }
    return null
  },
})

export const markPaid = internalMutation({
  args: { reference: v.string() },
  returns: v.null(),
  handler: async (ctx, { reference }) => {
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_reference', (q) => q.eq('reference', reference))
      .unique()
    if (payment === null || payment.status === 'paid' || payment.status === 'refunded') return null // processed once
    await ctx.db.patch(payment._id, { status: 'paid' })

    const order = await ctx.db.get(payment.orderId)
    if (!order) return null
    const seller = (await ctx.db.get(order.sellerId))!
    const customer = (await ctx.db.get(order.customerId))!

    if (order.status !== 'awaiting_payment') {
      // Paid after it was cancelled or replaced: record it and ask the seller to refund.
      await setPaymentStatus(ctx, order, 'paid')
      await raiseAttention(ctx, {
        sellerId: seller._id,
        type: 'payment_failed',
        orderId: order._id,
        summary: `Order ${orderLabel(order)} was paid (${formatCedis(payment.amountPesewas)}) after it was cancelled. Refund it from the order page, or deliver it.`,
        notify: true,
      })
      return null
    }

    const paid = await transition(ctx, order, 'paid', { paymentStatus: 'paid', note: `Paid ${formatCedis(payment.amountPesewas)}` })

    // Take the items out of stock.
    const short: string[] = []
    for (const item of order.items) {
      const product = await ctx.db.get(item.productId)
      if (!product) continue
      if (product.stock < item.qty) short.push(product.name)
      await ctx.db.patch(product._id, { stock: Math.max(0, product.stock - item.qty) })
    }
    if (short.length > 0) {
      await raiseAttention(ctx, {
        sellerId: seller._id,
        type: 'stock_problem',
        orderId: order._id,
        summary: `Order ${orderLabel(order)} is paid, but stock shows too few of: ${short.join(', ')}. Check before dispatching.`,
      })
    }

    await queueMessage(ctx, { sellerId: seller._id, to: customer.phone, orderId: order._id, text: copy.paid(paid, seller.businessName) })
    await queueMessage(ctx, {
      sellerId: seller._id,
      to: seller.phone,
      orderId: order._id,
      template: {
        name: 'stallo_seller_order_paid',
        params: [orderLabel(order), itemsSummary(order.items), formatCedis(order.totalPesewas)],
      },
    })
    return null
  },
})

export const markFailed = internalMutation({
  args: { reference: v.string(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { reference, reason }) => {
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_reference', (q) => q.eq('reference', reference))
      .unique()
    if (payment === null || payment.status !== 'pending') return null
    await ctx.db.patch(payment._id, { status: 'failed' })
    const order = await ctx.db.get(payment.orderId)
    if (!order) return null
    if (order.paymentStatus === 'pending') await setPaymentStatus(ctx, order, 'failed')
    await raiseAttention(ctx, {
      sellerId: order.sellerId,
      type: 'payment_failed',
      orderId: order._id,
      summary: `Payment for order ${orderLabel(order)} failed. ${reason}`,
    })
    return null
  },
})

/** refund.failed: the money didn't go back, so the order is paid again and the seller is told. */
export const handleRefundFailed = internalMutation({
  args: { reference: v.string() },
  returns: v.null(),
  handler: async (ctx, { reference }) => {
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_reference', (q) => q.eq('reference', reference))
      .unique()
    if (payment === null || payment.status !== 'refunded') return null
    await ctx.db.patch(payment._id, { status: 'paid' })
    const order = await ctx.db.get(payment.orderId)
    if (!order) return null
    await setPaymentStatus(ctx, order, 'paid')
    await raiseAttention(ctx, {
      sellerId: order.sellerId,
      type: 'refund_failed',
      orderId: order._id,
      summary: `The refund for order ${orderLabel(order)} failed at Paystack. Try again or contact the customer.`,
      notify: true,
    })
    return null
  },
})

// ---------------------------------------------------------------------------
// Seller actions: refund and cancel

const REFUNDABLE = new Set<Doc<'orders'>['status']>(['paid', 'delivered', 'delivery_failed', 'returned', 'cancelled'])
const CANCELLABLE = new Set<Doc<'orders'>['status']>(['draft', 'awaiting_confirmation', 'awaiting_payment', 'paid'])

export const prepare = internalQuery({
  args: { orderId: v.id('orders'), purpose: v.union(v.literal('refund'), v.literal('cancel')) },
  returns: v.object({ reference: v.union(v.string(), v.null()) }),
  handler: async (ctx, { orderId, purpose }) => {
    const seller = await requireSeller(ctx)
    const order = assertOwned(await ctx.db.get(orderId), seller, 'Order')
    if (purpose === 'cancel' && !CANCELLABLE.has(order.status)) {
      throw new ConvexError('Orders that are out for delivery or finished can’t be cancelled.')
    }
    if (purpose === 'refund' && (!REFUNDABLE.has(order.status) || order.paymentStatus !== 'paid')) {
      throw new ConvexError('Only paid orders can be refunded.')
    }
    if (order.paymentStatus !== 'paid') return { reference: null }
    const payments = await ctx.db
      .query('payments')
      .withIndex('by_order', (q) => q.eq('orderId', orderId))
      .take(20)
    const paid = payments.find((p) => p.status === 'paid')
    if (!paid) throw new ConvexError('No paid Paystack payment found for this order.')
    return { reference: paid.reference }
  },
})

async function refundAtPaystack(reference: string) {
  try {
    await paystackRefund(reference)
  } catch (error) {
    throw new ConvexError(`Paystack couldn’t start the refund: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export const recordRefund = internalMutation({
  args: { orderId: v.id('orders'), reference: v.string() },
  returns: v.null(),
  handler: async (ctx, { orderId, reference }) => {
    const seller = await requireSeller(ctx)
    const order = assertOwned(await ctx.db.get(orderId), seller, 'Order')
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_reference', (q) => q.eq('reference', reference))
      .unique()
    if (payment) await ctx.db.patch(payment._id, { status: 'refunded' })
    await setPaymentStatus(ctx, order, 'refunded')
    await ctx.db.patch(orderId, {
      timeline: [...order.timeline, { status: order.status, at: Date.now(), note: 'Refund started' }],
    })
    return null
  },
})

export const finishCancel = internalMutation({
  args: { orderId: v.id('orders'), refunded: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { orderId, refunded }) => {
    const seller = await requireSeller(ctx)
    const order = assertOwned(await ctx.db.get(orderId), seller, 'Order')
    const wasPaid = order.status === 'paid'
    const cancelled = await transition(ctx, order, 'cancelled', {
      note: refunded ? 'Cancelled by you and refunded' : 'Cancelled by you',
      ...(order.paymentStatus === 'pending' ? { paymentStatus: 'none' as const } : {}),
    })
    if (wasPaid) await restock(ctx, order)
    const customer = await ctx.db.get(order.customerId)
    if (customer && order.status !== 'draft') {
      await queueMessage(ctx, {
        sellerId: seller._id,
        to: customer.phone,
        orderId,
        text: copy.cancelledBySeller(seller.businessName, cancelled, refunded),
        template: { name: 'stallo_order_cancelled', params: [seller.businessName, orderLabel(order)] },
      })
    }
    return null
  },
})

/** Seller: refund a paid order in full through Paystack. */
export const refundOrder = action({
  args: { orderId: v.id('orders') },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const { reference } = await ctx.runQuery(internal.payments.prepare, { orderId, purpose: 'refund' })
    if (reference === null) throw new ConvexError('Only paid orders can be refunded.')
    await refundAtPaystack(reference)
    await ctx.runMutation(internal.payments.recordRefund, { orderId, reference })
    return null
  },
})

/** Seller: cancel an order. Paid orders are refunded first. */
export const cancelOrder = action({
  args: { orderId: v.id('orders') },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const { reference } = await ctx.runQuery(internal.payments.prepare, { orderId, purpose: 'cancel' })
    if (reference !== null) {
      await refundAtPaystack(reference)
      await ctx.runMutation(internal.payments.recordRefund, { orderId, reference })
    }
    await ctx.runMutation(internal.payments.finishCancel, { orderId, refunded: reference !== null })
    return null
  },
})

// ---------------------------------------------------------------------------
// Checking with Paystack ourselves, so a missed webhook never leaves an order stuck.

/** Marks the payment paid only if Paystack says it succeeded for the right amount. Never marks it failed. */
export const verifyIfPaid = internalAction({
  args: { reference: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { reference }): Promise<boolean> => {
    const payment = await ctx.runQuery(internal.payments.byReference, { reference })
    if (payment === null) return false
    if (payment.status === 'paid' || payment.status === 'refunded') return true
    const tx = await verifyTransaction(reference)
    if (tx.status !== 'success' || tx.amount !== payment.amountPesewas || tx.currency !== 'GHS') return false
    await ctx.runMutation(internal.payments.markPaid, { reference })
    return true
  },
})

/** Called by the page Paystack sends the customer to after paying. Safe to call by anyone: it only re-checks with Paystack. */
export const checkPayment = action({
  args: { reference: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { reference }): Promise<boolean> => {
    if (!/^STL-[A-Za-z0-9-]{1,40}$/.test(reference)) return false
    return await ctx.runAction(internal.payments.verifyIfPaid, { reference })
  },
})

export const pendingReferences = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const since = Date.now() - 2 * 24 * 60 * 60 * 1000
    const pending = await ctx.db
      .query('payments')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .order('desc')
      .take(100)
    return pending.filter((p) => p._creationTime > since).map((p) => p.reference)
  },
})

/** Cron: re-checks recent unpaid payment links with Paystack. */
export const checkPending = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const references: string[] = await ctx.runQuery(internal.payments.pendingReferences, {})
    for (const reference of references) {
      try {
        await ctx.runAction(internal.payments.verifyIfPaid, { reference })
      } catch {
        // Paystack unreachable: the next run tries again.
      }
    }
    return null
  },
})
