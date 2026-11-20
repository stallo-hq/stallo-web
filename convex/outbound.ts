import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { WhatsAppError, platformPhoneNumberId, platformToken, sendTemplate, sendText } from './integrations/whatsapp'
import { raiseAttention } from './model/attention'

/** Free-form messages are allowed for 24 hours after the person last wrote. Keep a small margin. */
const WINDOW_MS = 24 * 60 * 60 * 1000 - 5 * 60 * 1000
const MAX_ATTEMPTS = 5

export const load = internalQuery({
  args: { id: v.id('outboundMessages') },
  handler: async (ctx, { id }) => {
    const message = await ctx.db.get(id)
    if (message === null || message.status !== 'pending') return null
    const seller = await ctx.db.get(message.sellerId)
    const secret = await ctx.db
      .query('sellerSecrets')
      .withIndex('by_seller', (q) => q.eq('sellerId', message.sellerId))
      .unique()
    const fromNumber = message.channel === 'platform' ? platformPhoneNumberId() : (seller?.whatsappPhoneNumberId ?? null)
    const lastInbound = fromNumber
      ? await ctx.db
          .query('inboundMessages')
          .withIndex('by_number_and_from', (q) => q.eq('phoneNumberId', fromNumber).eq('from', message.recipient))
          .order('desc')
          .first()
      : null
    return {
      message,
      fromNumber,
      sellerToken: secret?.whatsappToken ?? null,
      lastInboundAt: lastInbound?.receivedAt ?? null,
    }
  },
})

export const markSent = internalMutation({
  args: { id: v.id('outboundMessages'), whatsappMessageId: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, whatsappMessageId }) => {
    await ctx.db.patch(id, { status: 'done', whatsappMessageId, error: undefined })
    return null
  },
})

export const markFailed = internalMutation({
  args: { id: v.id('outboundMessages'), error: v.string(), retryInMs: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { id, error, retryInMs }) => {
    const message = await ctx.db.get(id)
    if (message === null || message.status !== 'pending') return null
    const attempts = (message.attempts ?? 0) + 1
    if (retryInMs !== undefined && attempts < MAX_ATTEMPTS) {
      await ctx.db.patch(id, { attempts, error })
      await ctx.scheduler.runAfter(retryInMs, internal.outbound.send, { id })
      return null
    }
    await ctx.db.patch(id, { attempts, error, status: 'failed' })
    // The seller can act on a message their customer or rider never got.
    if (message.channel !== 'platform') {
      await raiseAttention(ctx, {
        sellerId: message.sellerId,
        type: 'message_failed',
        orderId: message.orderId,
        summary: `A WhatsApp message to ${message.recipient} could not be sent: ${error}`,
      })
    }
    return null
  },
})

/** From the WhatsApp status webhook: Meta accepted a message but couldn't deliver it. */
export const markFailedByWhatsAppId = internalMutation({
  args: { whatsappMessageId: v.string(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { whatsappMessageId, error }) => {
    const message = await ctx.db
      .query('outboundMessages')
      .withIndex('by_whatsapp_message_id', (q) => q.eq('whatsappMessageId', whatsappMessageId))
      .unique()
    if (message === null || message.status === 'failed') return null
    await ctx.db.patch(message._id, { status: 'failed', error })
    if (message.channel !== 'platform') {
      await raiseAttention(ctx, {
        sellerId: message.sellerId,
        type: 'message_failed',
        orderId: message.orderId,
        summary: `WhatsApp could not deliver a message to ${message.recipient}: ${error}`,
      })
    }
    return null
  },
})

function backoff(attempt: number): number {
  return Math.min(60_000, 2000 * 2 ** attempt) + Math.floor(Math.random() * 1000)
}

export const send = internalAction({
  args: { id: v.id('outboundMessages') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const loaded = await ctx.runQuery(internal.outbound.load, { id })
    if (loaded === null) return null
    const { message, fromNumber, sellerToken, lastInboundAt } = loaded

    if (fromNumber === null) {
      await ctx.runMutation(internal.outbound.markFailed, { id, error: 'WhatsApp is not connected' })
      return null
    }

    const windowOpen = lastInboundAt !== null && Date.now() - lastInboundAt < WINDOW_MS
    const params = message.templateParams ?? []
    try {
      const token = message.channel === 'platform' ? platformToken() : (sellerToken ?? platformToken())
      let whatsappMessageId: string
      if (message.text && (windowOpen || !message.template)) {
        try {
          whatsappMessageId = await sendText(fromNumber, token, message.recipient, message.text)
        } catch (error) {
          // Our clock and Meta's can disagree near the 24-hour edge: fall back to the template.
          if (error instanceof WhatsAppError && error.kind === 'outside_window' && message.template) {
            whatsappMessageId = await sendTemplate(fromNumber, token, message.recipient, message.template, params)
          } else throw error
        }
      } else if (message.template) {
        whatsappMessageId = await sendTemplate(fromNumber, token, message.recipient, message.template, params)
      } else {
        await ctx.runMutation(internal.outbound.markFailed, {
          id,
          error: 'More than 24 hours since this person last wrote, and this message has no template',
        })
        return null
      }
      await ctx.runMutation(internal.outbound.markSent, { id, whatsappMessageId })
    } catch (error) {
      const retryable = error instanceof WhatsAppError ? error.retryable : true
      await ctx.runMutation(internal.outbound.markFailed, {
        id,
        error: error instanceof Error ? error.message : String(error),
        retryInMs: retryable ? backoff(message.attempts ?? 0) : undefined,
      })
    }
    return null
  },
})
