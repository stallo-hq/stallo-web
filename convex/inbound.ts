import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { confidenceThreshold, extract, type AssistantInput } from './integrations/assistant'
import { matchPicture, visionConfigured, type CatalogueItem, type Picture, type PictureMatch } from './integrations/vision'
import { downloadMedia, messageText, platformToken, type InboundWhatsAppMessage } from './integrations/whatsapp'
import { formatCedis } from './lib/money'
import { toE164 } from './lib/phone'
import { raiseAttention } from './model/attention'
import { copy } from './model/copy'
import { describeLocation, handleCustomerMessage } from './model/conversation'
import { checkPin, isPinShaped } from './model/delivery'
import { queueMessage } from './model/outbound'

/**
 * Inbound WhatsApp messages (CLAUDE.md §3.2): stored first (unique by WhatsApp
 * message id, so Meta's retries are ignored), then processed. Anything still
 * pending after 2 minutes is retried by the cron; after 3 attempts it becomes a
 * Needs attention item. Nothing is dropped silently.
 */

export const MAX_ATTEMPTS = 3
const STUCK_AFTER_MS = 2 * 60 * 1000

const incomingMessage = v.object({
  id: v.string(),
  from: v.string(),
  profileName: v.optional(v.string()),
  raw: v.any(),
})

/** Called by the webhook. Stores each new message and starts processing it. */
export const receive = internalMutation({
  args: { phoneNumberId: v.string(), messages: v.array(incomingMessage) },
  returns: v.null(),
  handler: async (ctx, { phoneNumberId, messages }) => {
    const seller = await ctx.db
      .query('sellers')
      .withIndex('by_whatsapp_phone_number_id', (q) => q.eq('whatsappPhoneNumberId', phoneNumberId))
      .first()
    for (const message of messages) {
      const duplicate = await ctx.db
        .query('inboundMessages')
        .withIndex('by_whatsapp_message_id', (q) => q.eq('whatsappMessageId', message.id))
        .first()
      if (duplicate) continue
      const id = await ctx.db.insert('inboundMessages', {
        whatsappMessageId: message.id,
        sellerId: seller?._id,
        phoneNumberId,
        from: toE164(message.from),
        profileName: message.profileName,
        raw: message.raw,
        // Messages to Stallo's own number (or an unknown one) are only kept for the 24-hour window.
        status: seller ? 'pending' : 'done',
        attempts: 0,
        receivedAt: Date.now(),
      })
      if (seller) await ctx.scheduler.runAfter(0, internal.inbound.processMessage, { id })
    }
    return null
  },
})

/** Claims a processing attempt. False if it's done, already being worked on, or out of attempts. */
export const begin = internalMutation({
  args: { id: v.id('inboundMessages') },
  returns: v.boolean(),
  handler: async (ctx, { id }) => {
    const message = await ctx.db.get(id)
    if (message === null || message.status !== 'pending') return false
    // Another attempt started recently and hasn't finished or failed: let it run.
    const running = message.lastAttemptAt !== undefined && Date.now() - message.lastAttemptAt < STUCK_AFTER_MS && message.error === undefined
    if (running) return false
    if (message.attempts >= MAX_ATTEMPTS) {
      await giveUp(ctx, message)
      return false
    }
    await ctx.db.patch(id, { attempts: message.attempts + 1, lastAttemptAt: Date.now(), error: undefined })
    return true
  },
})

async function giveUp(ctx: Parameters<typeof raiseAttention>[0], message: Doc<'inboundMessages'>) {
  await ctx.db.patch(message._id, { status: 'failed' })
  if (!message.sellerId || !message.from) return
  const seller = await ctx.db.get(message.sellerId)
  if (!seller) return
  const text = messageText(message.raw as InboundWhatsAppMessage) ?? 'a message'
  await raiseAttention(ctx, {
    sellerId: seller._id,
    type: 'processing_failed',
    inboundMessageId: message._id,
    summary: `Stallo couldn't process a message from ${message.profileName ?? message.from}: “${text.slice(0, 160)}”. Reply to them on WhatsApp.`,
    notify: true,
  })
  await queueMessage(ctx, { sellerId: seller._id, to: message.from, text: copy.holding(seller.businessName) })
}

export const fail = internalMutation({
  args: { id: v.id('inboundMessages'), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, error }) => {
    const message = await ctx.db.get(id)
    if (message === null || message.status !== 'pending') return null
    await ctx.db.patch(id, { error: error.slice(0, 500) })
    if (message.attempts >= MAX_ATTEMPTS) await giveUp(ctx, message)
    return null
  },
})

type Context =
  | { kind: 'ignore' }
  | { kind: 'rider_pin'; deliveryId: Doc<'deliveries'>['_id']; pin: string }
  | { kind: 'media'; text: string; mediaType: string }
  | {
      kind: 'image'
      text: string
      caption: string | null
      whatsappMediaId: string
      storedMediaId: Id<'_storage'> | null
      sellerToken: string | null
      products: CatalogueItem[]
    }
  | { kind: 'location'; text: string; address: string; location: { lat: number; lng: number } }
  | { kind: 'text'; text: string; assistant: AssistantInput }

/** Everything processing needs, read in one go. */
export const context = internalQuery({
  args: { id: v.id('inboundMessages') },
  handler: async (ctx, { id }): Promise<Context> => {
    const message = await ctx.db.get(id)
    if (!message || message.status !== 'pending' || !message.sellerId || !message.from) return { kind: 'ignore' }
    const seller = await ctx.db.get(message.sellerId)
    if (!seller) return { kind: 'ignore' }
    const raw = message.raw as InboundWhatsAppMessage
    const text = messageText(raw)

    // A rider replying with the customer's code.
    const pin = text?.replace(/\D/g, '') ?? ''
    if (text !== null && isPinShaped(pin) && text.replace(/[\s\d.,-]/g, '').length <= 12) {
      const delivery = await ctx.db
        .query('deliveries')
        .withIndex('by_seller_rider_status', (q) =>
          q.eq('sellerId', seller._id).eq('riderPhone', message.from!).eq('status', 'dispatched'),
        )
        .order('desc')
        .first()
      if (delivery) return { kind: 'rider_pin', deliveryId: delivery._id, pin }
    }

    const image = (raw as { image?: { id?: string; caption?: string } }).image
    if (raw.type === 'image' && image?.id) {
      const products = await ctx.db
        .query('products')
        .withIndex('by_seller', (q) => q.eq('sellerId', seller._id))
        .take(200)
      const secret = await ctx.db
        .query('sellerSecrets')
        .withIndex('by_seller', (q) => q.eq('sellerId', seller._id))
        .unique()
      const caption = image.caption?.trim() || null
      return {
        kind: 'image',
        text: caption ? `[picture] ${caption}` : '[picture]',
        caption,
        whatsappMediaId: image.id,
        storedMediaId: message.mediaId ?? null,
        sellerToken: secret?.whatsappToken ?? null,
        products: products
          .filter((p) => p.active)
          .map((p) => ({ id: p._id, name: p.name, price: formatCedis(p.pricePesewas), photo: p.photoDescription ?? null })),
      }
    }

    if (raw.type === 'location' && raw.location) {
      return {
        kind: 'location',
        text: '[shared a location]',
        address: describeLocation(raw.location),
        location: { lat: raw.location.latitude, lng: raw.location.longitude },
      }
    }
    if (text === null || text.trim() === '') return { kind: 'media', text: `[${raw.type}]`, mediaType: raw.type.replace(/_/g, ' ') }

    const customer = await ctx.db
      .query('customers')
      .withIndex('by_seller_and_phone', (q) => q.eq('sellerId', seller._id).eq('phone', message.from!))
      .unique()
    const conversation = customer
      ? await ctx.db
          .query('conversations')
          .withIndex('by_seller_and_customer', (q) => q.eq('sellerId', seller._id).eq('customerId', customer._id))
          .unique()
      : null
    const order = conversation?.draftOrderId ? await ctx.db.get(conversation.draftOrderId) : null
    const open = order && ['draft', 'awaiting_confirmation', 'awaiting_payment'].includes(order.status) ? order : null
    const products = await ctx.db
      .query('products')
      .withIndex('by_seller', (q) => q.eq('sellerId', seller._id))
      .take(500)

    return {
      kind: 'text',
      text,
      assistant: {
        businessName: seller.businessName,
        products: products.map((p) => ({
          id: p._id,
          name: p.name,
          price: formatCedis(p.pricePesewas),
          available: p.active && p.stock > 0,
        })),
        basket: (open?.items ?? []).map((i) => ({ product_id: i.productId, name: i.name, quantity: i.qty })),
        address: open?.address ?? customer?.lastAddress ?? null,
        recipient: open?.recipientName || open?.recipientPhone ? [open.recipientName, open.recipientPhone].filter(Boolean).join(', ') : null,
        deliveryAreas: seller.deliveryAreas ?? null,
        awaitingConfirmation: open?.status === 'awaiting_confirmation',
        history: (conversation?.history ?? []).slice(-8).map(({ from, text }) => ({ from, text })),
        message: text.slice(0, 2000),
      },
    }
  },
})

const extraction = v.object({
  intent: v.union(
    v.literal('order'),
    v.literal('confirm'),
    v.literal('cancel'),
    v.literal('question'),
    v.literal('greeting'),
    v.literal('other'),
  ),
  items: v.union(v.null(), v.array(v.object({ product_id: v.string(), quantity: v.number() }))),
  address: v.union(v.null(), v.string()),
  customer_name: v.union(v.null(), v.string()),
  recipient_name: v.union(v.null(), v.string()),
  recipient_phone: v.union(v.null(), v.string()),
  outside_delivery_area: v.union(v.null(), v.boolean()),
  unmatched: v.array(v.string()),
  reply: v.union(v.null(), v.string()),
  confidence: v.number(),
})

const pictureMatch = v.object({
  description: v.string(),
  text_in_image: v.union(v.null(), v.string()),
  matches: v.array(v.object({ product_id: v.string(), confidence: v.number() })),
})

/** Keeps a copy of the customer's picture with the message, so retries don't download it again. */
export const attachMedia = internalMutation({
  args: { id: v.id('inboundMessages'), mediaId: v.id('_storage') },
  returns: v.null(),
  handler: async (ctx, { id, mediaId }) => {
    const message = await ctx.db.get(id)
    if (message && !message.mediaId) await ctx.db.patch(id, { mediaId })
    return null
  },
})

/** Applies the result of processing. Exactly once: does nothing if the message is no longer pending. */
export const apply = internalMutation({
  args: {
    id: v.id('inboundMessages'),
    input: v.union(
      v.object({ kind: v.literal('text'), text: v.string(), extraction, threshold: v.number() }),
      v.object({
        kind: v.literal('location'),
        text: v.string(),
        address: v.string(),
        location: v.object({ lat: v.number(), lng: v.number() }),
      }),
      v.object({ kind: v.literal('media'), text: v.string(), mediaType: v.string() }),
      v.object({ kind: v.literal('image'), text: v.string(), match: v.union(v.null(), pictureMatch) }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { id, input }) => {
    const message = await ctx.db.get(id)
    if (!message || message.status !== 'pending' || !message.sellerId) return null
    const seller = await ctx.db.get(message.sellerId)
    if (!seller) return null
    await handleCustomerMessage(ctx, message, seller, input)
    await ctx.db.patch(id, { status: 'done', error: undefined })
    return null
  },
})

/** A rider sent the customer's code on WhatsApp. */
export const applyRiderPin = internalMutation({
  args: { id: v.id('inboundMessages'), deliveryId: v.id('deliveries'), pin: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, deliveryId, pin }) => {
    const message = await ctx.db.get(id)
    const delivery = await ctx.db.get(deliveryId)
    if (!message || message.status !== 'pending' || !delivery || !message.from || !message.sellerId) return null
    const order = await ctx.db.get(delivery.orderId)
    const result = await checkPin(ctx, delivery, pin)
    if (order) {
      await queueMessage(ctx, {
        sellerId: message.sellerId,
        to: message.from,
        text: result.ok ? copy.riderDelivered(order) : copy.riderWrongPin(result.attemptsLeft),
      })
    }
    await ctx.db.patch(id, { status: 'done' })
    return null
  },
})

export const processMessage = internalAction({
  args: { id: v.id('inboundMessages') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    if (!(await ctx.runMutation(internal.inbound.begin, { id }))) return null
    try {
      const c = await ctx.runQuery(internal.inbound.context, { id })
      switch (c.kind) {
        case 'ignore':
          return null
        case 'rider_pin':
          await ctx.runMutation(internal.inbound.applyRiderPin, { id, deliveryId: c.deliveryId, pin: c.pin })
          return null
        case 'image': {
          let picture: Picture | null = null
          if (c.storedMediaId) {
            const blob = await ctx.storage.get(c.storedMediaId)
            if (blob) picture = { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type || 'image/jpeg' }
          } else {
            // A failed download throws, so the message is retried like any other.
            picture = await downloadMedia(c.whatsappMediaId, c.sellerToken ?? platformToken())
            const mediaId = await ctx.storage.store(new Blob([new Uint8Array(picture.bytes)], { type: picture.mimeType }))
            await ctx.runMutation(internal.inbound.attachMedia, { id, mediaId })
          }
          let match: PictureMatch | null = null
          if (picture && visionConfigured() && c.products.length > 0) {
            try {
              match = await matchPicture(picture, c.products, c.caption)
            } catch (error) {
              console.error('Picture matching failed:', error instanceof Error ? error.message : error)
              match = null // The seller sees the picture under Needs attention instead.
            }
          }
          await ctx.runMutation(internal.inbound.apply, { id, input: { kind: 'image', text: c.text, match } })
          return null
        }
        case 'media':
          await ctx.runMutation(internal.inbound.apply, { id, input: { kind: 'media', text: c.text, mediaType: c.mediaType } })
          return null
        case 'location':
          await ctx.runMutation(internal.inbound.apply, {
            id,
            input: { kind: 'location', text: c.text, address: c.address, location: c.location },
          })
          return null
        case 'text': {
          const result = await extract(c.assistant)
          await ctx.runMutation(internal.inbound.apply, {
            id,
            input: { kind: 'text', text: c.text, extraction: result, threshold: confidenceThreshold() },
          })
          return null
        }
      }
    } catch (error) {
      await ctx.runMutation(internal.inbound.fail, { id, error: error instanceof Error ? error.message : String(error) })
    }
    return null
  },
})

/** Cron: retries messages stuck in pending for more than 2 minutes. */
export const retryStuck = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - STUCK_AFTER_MS
    const stuck = await ctx.db
      .query('inboundMessages')
      .withIndex('by_status_and_received', (q) => q.eq('status', 'pending').lt('receivedAt', cutoff))
      .take(100)
    for (const message of stuck) {
      if (message.lastAttemptAt !== undefined && message.lastAttemptAt > cutoff) continue
      if (message.attempts >= MAX_ATTEMPTS) {
        await giveUp(ctx, message)
        continue
      }
      // Clear the in-progress marker so `begin` lets the retry through.
      await ctx.db.patch(message._id, { error: message.error ?? 'Timed out' })
      await ctx.scheduler.runAfter(0, internal.inbound.processMessage, { id: message._id })
    }
    return null
  },
})
