import type { Doc, Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import type { Extraction } from '../integrations/assistant'
import { raiseAttention } from './attention'
import { copy } from './copy'
import { calculateFee, sellerFeeConfig } from './fees'
import { nextOrderNumber, subtotalOf, transition } from './orders'
import { queueInOrder } from './outbound'

/**
 * What happens when a customer writes to a seller. The assistant only says what
 * the message means; every order change, price and reply is decided here.
 */

const HISTORY_LIMIT = 12
const OPEN_STATUSES = new Set<Doc<'orders'>['status']>(['draft', 'awaiting_confirmation', 'awaiting_payment'])

export type CustomerInput =
  | { kind: 'text'; text: string; extraction: Extraction; threshold: number }
  | { kind: 'location'; text: string; address: string; location: { lat: number; lng: number } }
  | { kind: 'media'; text: string; mediaType: string }

type State = {
  seller: Doc<'sellers'>
  customer: Doc<'customers'>
  conversation: Doc<'conversations'>
  order: Doc<'orders'> | null
  products: Doc<'products'>[]
  replies: string[]
}

export async function findOrCreateCustomer(
  ctx: MutationCtx,
  sellerId: Id<'sellers'>,
  phone: string,
  profileName?: string,
): Promise<Doc<'customers'>> {
  const existing = await ctx.db
    .query('customers')
    .withIndex('by_seller_and_phone', (q) => q.eq('sellerId', sellerId).eq('phone', phone))
    .unique()
  if (existing) {
    if (!existing.name && profileName) await ctx.db.patch(existing._id, { name: profileName })
    return existing.name || !profileName ? existing : { ...existing, name: profileName }
  }
  const id = await ctx.db.insert('customers', { sellerId, phone, ...(profileName ? { name: profileName } : {}) })
  return (await ctx.db.get(id))!
}

export async function findOrCreateConversation(
  ctx: MutationCtx,
  sellerId: Id<'sellers'>,
  customerId: Id<'customers'>,
): Promise<Doc<'conversations'>> {
  const existing = await ctx.db
    .query('conversations')
    .withIndex('by_seller_and_customer', (q) => q.eq('sellerId', sellerId).eq('customerId', customerId))
    .unique()
  if (existing) return existing
  const id = await ctx.db.insert('conversations', { sellerId, customerId, state: 'idle', lastInboundAt: Date.now(), history: [] })
  return (await ctx.db.get(id))!
}

export async function activeProducts(ctx: MutationCtx, sellerId: Id<'sellers'>) {
  const all = await ctx.db
    .query('products')
    .withIndex('by_seller', (q) => q.eq('sellerId', sellerId))
    .take(500)
  return all.sort((a, b) => a.name.localeCompare(b.name))
}

/** The order this conversation is working on, if it's still open. */
export async function openOrder(ctx: MutationCtx, conversation: Doc<'conversations'>) {
  if (!conversation.draftOrderId) return null
  const order = await ctx.db.get(conversation.draftOrderId)
  return order && OPEN_STATUSES.has(order.status) ? order : null
}

export async function handleCustomerMessage(
  ctx: MutationCtx,
  inbound: Doc<'inboundMessages'>,
  seller: Doc<'sellers'>,
  input: CustomerInput,
): Promise<void> {
  const customer = await findOrCreateCustomer(ctx, seller._id, inbound.from!, inbound.profileName)
  const conversation = await findOrCreateConversation(ctx, seller._id, customer._id)
  const products = await activeProducts(ctx, seller._id)
  const state: State = { seller, customer, conversation, order: await openOrder(ctx, conversation), products, replies: [] }

  if (input.kind === 'media') {
    state.replies.push(copy.unsupportedMedia(seller.businessName))
    await raiseAttention(ctx, {
      sellerId: seller._id,
      type: 'low_confidence',
      inboundMessageId: inbound._id,
      summary: `${customer.name ?? customer.phone} sent a ${input.mediaType} message. Reply to them on WhatsApp.`,
      notify: true,
    })
  } else if (input.kind === 'location') {
    await ctx.db.patch(customer._id, { lastAddress: input.address })
    if (state.order && state.order.status !== 'awaiting_payment') {
      await updateBasket(ctx, state, { items: null, address: input.address, location: input.location, unmatched: [] })
    } else {
      state.replies.push(`Thanks, I've saved your location. ${copy.askWhatToOrder(products.filter((p) => p.active))}`)
    }
  } else {
    await handleText(ctx, state, inbound, input)
  }

  await finish(ctx, state, input.text)
}

async function handleText(
  ctx: MutationCtx,
  state: State,
  inbound: Doc<'inboundMessages'>,
  input: Extract<CustomerInput, { kind: 'text' }>,
) {
  const { extraction } = input
  const { seller, customer } = state
  const available = state.products.filter((p) => p.active && p.stock > 0)

  if (extraction.customer_name && !customer.name) {
    await ctx.db.patch(customer._id, { name: extraction.customer_name })
    state.customer = { ...customer, name: extraction.customer_name }
  }

  if (extraction.confidence < input.threshold && extraction.intent !== 'greeting') {
    state.replies.push(copy.holding(seller.businessName))
    await raiseAttention(ctx, {
      sellerId: seller._id,
      type: 'low_confidence',
      orderId: state.order?._id,
      inboundMessageId: inbound._id,
      summary: `Not sure what ${customer.name ?? customer.phone} meant: “${input.text.slice(0, 200)}”. Reply to them on WhatsApp.`,
      notify: true,
    })
    return
  }

  switch (extraction.intent) {
    case 'greeting': {
      state.replies.push(state.order ? (extraction.reply ?? copy.askWhatToOrder(available)) : copy.welcome(seller.businessName, available))
      return
    }
    case 'question':
    case 'other': {
      state.replies.push(extraction.reply ?? copy.holding(seller.businessName))
      return
    }
    case 'cancel': {
      if (state.order) {
        await transition(ctx, state.order, 'cancelled', {
          note: 'Cancelled by the customer on WhatsApp',
          ...(state.order.paymentStatus === 'pending' ? { paymentStatus: 'none' as const } : {}),
        })
        await ctx.db.patch(state.conversation._id, { state: 'idle', draftOrderId: undefined })
        state.order = null
        state.replies.push(copy.cancelledByCustomer())
      } else {
        state.replies.push(copy.nothingToCancel())
      }
      return
    }
    case 'confirm': {
      await confirmOrder(ctx, state)
      return
    }
    case 'order': {
      if (state.products.length === 0) {
        state.replies.push(copy.holding(seller.businessName))
        await raiseAttention(ctx, {
          sellerId: seller._id,
          type: 'stock_problem',
          summary: `${customer.name ?? customer.phone} wants to order, but you have no products in Stallo yet. Add them, then reply to the customer.`,
          notify: true,
        })
        return
      }
      await updateBasket(ctx, state, {
        items: extraction.items,
        address: extraction.address,
        unmatched: extraction.unmatched,
      })
      return
    }
  }
}

/**
 * Applies basket and address changes, then asks for whatever is missing or for
 * confirmation. Prices and availability always come from the product list.
 */
async function updateBasket(
  ctx: MutationCtx,
  state: State,
  change: {
    items: { product_id: string; quantity: number }[] | null
    address: string | null
    location?: { lat: number; lng: number }
    unmatched: string[]
  },
) {
  const { seller, customer } = state
  let order = state.order

  // An unpaid order that already has a payment link is replaced by a new one.
  if (order?.status === 'awaiting_payment') {
    await transition(ctx, order, 'cancelled', { note: 'Customer changed the order before paying', paymentStatus: 'none' })
    order = null
  }
  const base = order?.items ?? state.order?.items ?? []
  const byId = new Map(state.products.map((p) => [p._id as string, p]))

  const unavailable = [...change.unmatched]
  const notes: string[] = []
  const wanted = change.items ?? base.map((i) => ({ product_id: i.productId as string, quantity: i.qty }))
  const items: Doc<'orders'>['items'] = []
  for (const want of wanted) {
    const product = byId.get(want.product_id)
    if (!product) continue
    if (!product.active || product.stock <= 0) {
      unavailable.push(product.name)
      continue
    }
    const qty = Math.min(want.quantity, product.stock)
    if (qty < want.quantity) notes.push(copy.limitedStock(product.name, product.stock))
    items.push({ productId: product._id, name: product.name, unitPricePesewas: product.pricePesewas, qty })
  }

  let usingSavedAddress = false
  let address = change.address ?? order?.address ?? state.order?.address
  if (!address && customer.lastAddress) {
    address = customer.lastAddress
    usingSavedAddress = true
  }
  if (change.address) await ctx.db.patch(customer._id, { lastAddress: change.address })

  const subtotal = subtotalOf(items)
  const fields = {
    items,
    subtotalPesewas: subtotal,
    feePesewas: 0,
    totalPesewas: subtotal,
    address,
    ...(change.location ? { location: change.location } : {}),
  }

  if (order === null) {
    const id = await ctx.db.insert('orders', {
      sellerId: seller._id,
      customerId: customer._id,
      number: await nextOrderNumber(ctx, seller._id),
      ...fields,
      status: 'draft',
      paymentStatus: 'none',
      timeline: [{ status: 'draft', at: Date.now() }],
      createdAt: Date.now(),
    })
    order = (await ctx.db.get(id))!
  } else {
    await ctx.db.patch(order._id, fields)
    order = { ...order, ...fields }
  }

  if (unavailable.length > 0) state.replies.push(copy.unavailable(unavailable))
  state.replies.push(...notes)

  let conversationState: Doc<'conversations'>['state'] = 'collecting'
  if (items.length === 0) {
    if (order.status === 'awaiting_confirmation') order = await transition(ctx, order, 'draft')
    state.replies.push(copy.askWhatToOrder(state.products.filter((p) => p.active && p.stock > 0)))
  } else if (!address) {
    if (order.status === 'awaiting_confirmation') order = await transition(ctx, order, 'draft')
    state.replies.push(copy.askAddress(order))
  } else {
    if (order.status === 'draft') order = await transition(ctx, order, 'awaiting_confirmation')
    state.replies.push(copy.confirm(order, usingSavedAddress))
    conversationState = 'awaiting_confirmation'
  }

  state.order = order
  await ctx.db.patch(state.conversation._id, { state: conversationState, draftOrderId: order._id })
}

async function confirmOrder(ctx: MutationCtx, state: State) {
  const { seller, customer } = state
  const order = state.order
  if (order?.status === 'awaiting_payment') {
    state.replies.push(order.paymentUrl ? copy.payLink(order, order.paymentUrl) : copy.payLinkDelayed(seller.businessName))
    return
  }
  if (order?.status !== 'awaiting_confirmation') {
    state.replies.push(copy.nothingToConfirm(state.products.filter((p) => p.active && p.stock > 0)))
    return
  }

  // Check stock again: it may have changed since the summary went out.
  const byId = new Map(state.products.map((p) => [p._id as string, p]))
  const stillFine = order.items.every((i) => {
    const p = byId.get(i.productId)
    return p !== undefined && p.active && p.stock >= i.qty && p.pricePesewas === i.unitPricePesewas
  })
  if (!stillFine) {
    await updateBasket(ctx, state, { items: null, address: null, unmatched: [] })
    return
  }

  const fee = calculateFee(order.subtotalPesewas, sellerFeeConfig(seller))
  const confirmed = await transition(ctx, order, 'awaiting_payment', {
    paymentStatus: 'pending',
    feePesewas: fee,
    totalPesewas: order.subtotalPesewas,
    note: 'Confirmed by the customer',
  })
  if (confirmed.address) await ctx.db.patch(customer._id, { lastAddress: confirmed.address })
  await ctx.db.patch(state.conversation._id, { state: 'idle' })
  state.order = confirmed
  // The payment-link message is sent once Paystack gives us the link.
  await ctx.scheduler.runAfter(0, internal.payments.createLink, { orderId: confirmed._id })
}

async function finish(ctx: MutationCtx, state: State, inboundText: string) {
  const now = Date.now()
  const history = [
    ...(state.conversation.history ?? []),
    { from: 'customer' as const, text: inboundText.slice(0, 500), at: now },
    ...state.replies.map((text) => ({ from: 'stallo' as const, text: text.slice(0, 500), at: now })),
  ].slice(-HISTORY_LIMIT)
  await ctx.db.patch(state.conversation._id, { history, lastInboundAt: now })
  await queueInOrder(
    ctx,
    state.replies.map((text) => ({ sellerId: state.seller._id, to: state.customer.phone, text, orderId: state.order?._id })),
  )
}

export function describeLocation(location: { latitude: number; longitude: number; name?: string; address?: string }): string {
  const label = [location.name, location.address].filter(Boolean).join(', ')
  const pin = `https://maps.google.com/?q=${location.latitude},${location.longitude}`
  return label ? `${label} (${pin})` : pin
}
