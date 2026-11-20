import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { action, internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from './_generated/server'
import { mapsUrl } from './lib/address'
import { toE164Ghana } from './lib/phone'
import { assertOwned, requireSeller } from './model/auth'
import { copy, receiverLabel } from './model/copy'
import { randomDigits, randomToken, sha256 } from './model/crypto'
import { PIN_LENGTH, checkPin, hashPin, markDeliveryFailed, restock, MAX_PIN_ATTEMPTS } from './model/delivery'
import { orderLabel, transition } from './model/orders'
import { queueMessage } from './model/outbound'
import { cleanText } from './model/validation'

/**
 * Sends the delivery code to the buyer on WhatsApp and, when the order is for
 * someone else, to the receiver by SMS (they may never have messaged the seller).
 */
async function sendDeliveryCode(
  ctx: MutationCtx,
  { seller, order, customer, riderName, pin }: { seller: Doc<'sellers'>; order: Doc<'orders'>; customer: Doc<'customers'>; riderName: string; pin: string },
) {
  await queueMessage(ctx, {
    sellerId: seller._id,
    to: customer.phone,
    orderId: order._id,
    text: copy.deliveryPin(seller.businessName, order, riderName, pin),
    template: { name: 'stallo_delivery_pin', params: [seller.businessName, orderLabel(order), riderName, pin] },
  })
  if (order.recipientPhone && order.recipientPhone !== customer.phone) {
    await ctx.scheduler.runAfter(0, internal.sms.sendDeliveryCode, {
      sellerId: seller._id,
      orderId: order._id,
      to: order.recipientPhone,
      text: copy.recipientPin(seller.businessName, order, customer.name ?? 'Someone', riderName, pin),
    })
  }
}

function riderLink(token: string): string {
  const site = (process.env.SITE_URL ?? '').replace(/\/$/, '')
  return `${site}/r/${token}`
}

/**
 * Seller: hand a paid order to a rider. Creates a 4-digit PIN for the customer
 * and a private page link for the rider. Secrets are generated here, in an
 * action, then stored hashed.
 */
export const dispatch = action({
  args: { orderId: v.id('orders'), riderName: v.string(), riderPhone: v.string() },
  returns: v.object({ riderLink: v.string() }),
  handler: async (ctx, args): Promise<{ riderLink: string }> => {
    const pin = randomDigits(PIN_LENGTH)
    const token = randomToken()
    await ctx.runMutation(internal.deliveries.applyDispatch, {
      ...args,
      pin,
      pinHash: await hashPin(args.orderId, pin),
      token,
      tokenHash: await sha256(token),
    })
    // Shown to the seller once, so they can forward it if WhatsApp can't reach the rider.
    return { riderLink: riderLink(token) }
  },
})

export const applyDispatch = internalMutation({
  args: {
    orderId: v.id('orders'),
    riderName: v.string(),
    riderPhone: v.string(),
    pin: v.string(),
    pinHash: v.string(),
    token: v.string(),
    tokenHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seller = await requireSeller(ctx)
    const order = assertOwned(await ctx.db.get(args.orderId), seller, 'Order')
    if (order.status !== 'paid' && order.status !== 'delivery_failed') {
      throw new ConvexError('Only paid orders can be sent out for delivery.')
    }
    const riderName = cleanText(args.riderName, 'Rider name', { min: 2, max: 60 })
    const riderPhone = toE164Ghana(args.riderPhone)
    if (riderPhone === null) throw new ConvexError('Enter the rider’s Ghana mobile number, e.g. 024 123 4567.')
    const customer = (await ctx.db.get(order.customerId))!

    const deliveryId = await ctx.db.insert('deliveries', {
      orderId: order._id,
      sellerId: seller._id,
      riderName,
      riderPhone,
      pinHash: args.pinHash,
      riderTokenHash: args.tokenHash,
      attempts: 0,
      status: 'dispatched',
      dispatchedAt: Date.now(),
    })
    const dispatched = await transition(ctx, order, 'dispatched', { deliveryId, note: `With ${riderName}` })

    await sendDeliveryCode(ctx, { seller, order: dispatched, customer, riderName, pin: args.pin })
    const link = riderLink(args.token)
    const customerLabel = customer.name ? `${customer.name} (${customer.phone})` : customer.phone
    const receiver = receiverLabel(order)
    const who = receiver ? `${receiver}, ordered by ${customerLabel}` : customerLabel
    await queueMessage(ctx, {
      sellerId: seller._id,
      to: riderPhone,
      orderId: order._id,
      text: copy.riderJob(seller.businessName, dispatched, customerLabel, link),
      template: {
        name: 'stallo_rider_job',
        params: [seller.businessName, orderLabel(order), who, order.address ?? 'Call the customer', link],
      },
    })
    return null
  },
})

async function currentDelivery(ctx: Parameters<typeof requireSeller>[0], order: Doc<'orders'>) {
  return order.deliveryId ? await ctx.db.get(order.deliveryId) : null
}

/** Seller: the rider couldn't deliver. */
export const markFailed = mutation({
  args: { orderId: v.id('orders'), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { orderId, reason }) => {
    const seller = await requireSeller(ctx)
    const order = assertOwned(await ctx.db.get(orderId), seller, 'Order')
    const delivery = await currentDelivery(ctx, order)
    if (order.status !== 'dispatched' || delivery === null) throw new ConvexError('This order is not out for delivery.')
    await markDeliveryFailed(ctx, delivery, reason, 'You')
    return null
  },
})

/** Seller: a failed delivery came back. The items go back into stock. */
export const markReturned = mutation({
  args: { orderId: v.id('orders') },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const seller = await requireSeller(ctx)
    const order = assertOwned(await ctx.db.get(orderId), seller, 'Order')
    if (order.status !== 'delivery_failed') throw new ConvexError('Only a failed delivery can be marked returned.')
    const delivery = await currentDelivery(ctx, order)
    if (delivery) await ctx.db.patch(delivery._id, { status: 'returned' })
    await transition(ctx, order, 'returned', { note: 'Items back with you' })
    await restock(ctx, order)
    return null
  },
})

// ---------------------------------------------------------------------------
// Rider page: public, no login. The link token is the only key.

export const riderJob = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      businessName: v.string(),
      sellerPhone: v.string(),
      orderLabel: v.string(),
      items: v.array(v.object({ name: v.string(), qty: v.number() })),
      customerName: v.optional(v.string()),
      customerPhone: v.string(),
      recipientName: v.optional(v.string()),
      recipientPhone: v.optional(v.string()),
      address: v.optional(v.string()),
      digitalAddress: v.optional(v.string()),
      hasPin: v.boolean(),
      mapsUrl: v.optional(v.string()),
      riderName: v.string(),
      status: v.union(v.literal('dispatched'), v.literal('delivered'), v.literal('failed'), v.literal('returned')),
      attemptsLeft: v.number(),
    }),
  ),
  handler: async (ctx, { token }) => {
    if (!/^[0-9a-f]{64}$/.test(token)) return null
    const tokenHash = await sha256(token)
    const delivery = await ctx.db
      .query('deliveries')
      .withIndex('by_rider_token', (q) => q.eq('riderTokenHash', tokenHash))
      .unique()
    if (!delivery) return null
    const order = await ctx.db.get(delivery.orderId)
    if (!order) return null
    const seller = await ctx.db.get(order.sellerId)
    const customer = await ctx.db.get(order.customerId)
    if (!seller || !customer) return null
    // Customer details are only shown while the job is open.
    const open = delivery.status === 'dispatched'
    return {
      businessName: seller.businessName,
      sellerPhone: seller.phone,
      orderLabel: orderLabel(order),
      items: order.items.map(({ name, qty }) => ({ name, qty })),
      customerName: open ? customer.name : undefined,
      customerPhone: open ? customer.phone : '',
      recipientName: open ? order.recipientName : undefined,
      recipientPhone: open ? order.recipientPhone : undefined,
      address: open ? order.address : undefined,
      digitalAddress: open ? order.digitalAddress : undefined,
      hasPin: open && order.location !== undefined,
      mapsUrl: open ? mapsUrl(order) : undefined,
      riderName: delivery.riderName,
      status: delivery.status,
      attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - delivery.attempts),
    }
  },
})

async function deliveryForToken(ctx: Parameters<typeof requireSeller>[0], token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new ConvexError('This delivery link is not valid.')
  const tokenHash = await sha256(token)
  const delivery = await ctx.db
    .query('deliveries')
    .withIndex('by_rider_token', (q) => q.eq('riderTokenHash', tokenHash))
    .unique()
  if (!delivery) throw new ConvexError('This delivery link is not valid.')
  return delivery
}

export const riderConfirm = mutation({
  args: { token: v.string(), pin: v.string() },
  returns: v.object({ ok: v.boolean(), attemptsLeft: v.number(), message: v.string() }),
  handler: async (ctx, { token, pin }) => {
    const delivery = await deliveryForToken(ctx, token)
    const clean = pin.replace(/\D/g, '')
    if (clean.length !== PIN_LENGTH) {
      return { ok: false, attemptsLeft: MAX_PIN_ATTEMPTS - delivery.attempts, message: `Enter the ${PIN_LENGTH}-digit code from the customer.` }
    }
    const result = await checkPin(ctx, delivery, clean)
    if (result.ok) return { ok: true, attemptsLeft: 0, message: 'Delivered. Thank you.' }
    const message =
      result.reason === 'closed'
        ? 'This delivery is already closed.'
        : result.reason === 'locked'
          ? 'Too many wrong codes. The seller has been told; call them.'
          : `That code isn’t right. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'try' : 'tries'} left.`
    return { ok: false, attemptsLeft: result.attemptsLeft, message }
  },
})

export const riderReportFailed = mutation({
  args: { token: v.string(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { token, reason }) => {
    const delivery = await deliveryForToken(ctx, token)
    await markDeliveryFailed(ctx, delivery, reason, `Rider ${delivery.riderName}`)
    return null
  },
})

/** The customer asked for their code again. The old one is hashed, so send a fresh one. */
export const resendPin = internalAction({
  args: { deliveryId: v.id('deliveries') },
  returns: v.null(),
  handler: async (ctx, { deliveryId }): Promise<null> => {
    const orderId: Id<'orders'> | null = await ctx.runQuery(internal.deliveries.openDeliveryOrder, { deliveryId })
    if (orderId === null) return null
    const pin = randomDigits(PIN_LENGTH)
    await ctx.runMutation(internal.deliveries.applyNewPin, { deliveryId, pin, pinHash: await hashPin(orderId, pin) })
    return null
  },
})

export const openDeliveryOrder = internalQuery({
  args: { deliveryId: v.id('deliveries') },
  returns: v.union(v.id('orders'), v.null()),
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get(deliveryId)
    return delivery && delivery.status === 'dispatched' ? delivery.orderId : null
  },
})

export const applyNewPin = internalMutation({
  args: { deliveryId: v.id('deliveries'), pin: v.string(), pinHash: v.string() },
  returns: v.null(),
  handler: async (ctx, { deliveryId, pin, pinHash }) => {
    const delivery = await ctx.db.get(deliveryId)
    if (!delivery || delivery.status !== 'dispatched') return null
    const order = (await ctx.db.get(delivery.orderId))!
    const seller = (await ctx.db.get(order.sellerId))!
    const customer = (await ctx.db.get(order.customerId))!
    await ctx.db.patch(deliveryId, { pinHash, attempts: 0 })
    await sendDeliveryCode(ctx, { seller, order, customer, riderName: delivery.riderName, pin })
    return null
  },
})
