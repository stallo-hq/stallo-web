import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { internalAction, internalMutation, type MutationCtx } from './_generated/server'
import { EvolutionError, markRead, sendText, type InboundWhatsAppMessage } from './integrations/evolution'
import { SmsError, sendSms } from './integrations/sasusync'
import { raiseAttention } from './model/attention'

/**
 * Sending from a seller's linked WhatsApp (ADR 0002). Every message goes through
 * `send`, which enforces the safety rules before anything leaves:
 *  1. Inbound only: WhatsApp only to someone who wrote to this seller in the last
 *     24 hours. Otherwise SMS (if the message must arrive) or Needs attention.
 *  2. Hourly limit per seller: 25 while the link is under 7 days old, then 60.
 *     Extra messages wait their turn; nothing is burst or dropped.
 *  3. One chat at a time, in order.
 *  4. Seen, then a short "typing…", then the text. Timed with the scheduler;
 *     the typing pause itself is held by Evolution (sendText `delay`).
 */

export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000
export const NEW_LINK_MS = 7 * 24 * 60 * 60 * 1000
export const HOURLY_LIMIT_NEW = 25
export const HOURLY_LIMIT = 60
const HOUR_MS = 60 * 60 * 1000
/** A send that hasn't finished in this long is assumed lost and may be retried. */
const IN_FLIGHT_MS = 2 * 60 * 1000
const CHAT_ORDER_WAIT_MS = 2000
const MAX_ATTEMPTS = 5

export function hourlyLimit(connectedAt: number, now = Date.now()): number {
  return now - connectedAt < NEW_LINK_MS ? HOURLY_LIMIT_NEW : HOURLY_LIMIT
}

/** Short and a little uneven, longer for longer messages: 1.5 to 4 seconds. */
export function typingMs(text: string, random = Math.random()): number {
  return Math.round(Math.min(4000, Math.max(1500, 1000 + text.length * 15)) + (random - 0.5) * 600)
}

type Claim =
  | null
  | { kind: 'sms'; to: string; text: string }
  | { kind: 'whatsapp'; instance: string; to: string; text: string; read: { jid: string; id: string } | null }

async function lastInboundFrom(ctx: MutationCtx, message: Doc<'outboundMessages'>) {
  return await ctx.db
    .query('inboundMessages')
    .withIndex('by_seller_from_received', (q) => q.eq('sellerId', message.sellerId).eq('from', message.recipient))
    .order('desc')
    .first()
}

async function giveUp(ctx: MutationCtx, message: Doc<'outboundMessages'>, error: string) {
  await ctx.db.patch(message._id, { status: 'failed', error, sendingAt: undefined, sentAt: undefined })
  await raiseAttention(ctx, {
    sellerId: message.sellerId,
    type: 'message_failed',
    orderId: message.orderId,
    summary: `A message to ${message.recipient} was not sent: ${error}`,
  })
}

/** Decides whether, how and when a message may go now. Mutations are serialised, so the limit holds. */
export const claim = internalMutation({
  args: { id: v.id('outboundMessages') },
  handler: async (ctx, { id }): Promise<Claim> => {
    const message = await ctx.db.get(id)
    if (message === null || message.status !== 'pending' || !message.text) return null
    const now = Date.now()
    if (message.sendingAt !== undefined && now - message.sendingAt < IN_FLIGHT_MS) return null
    if (message.notBefore !== undefined && message.notBefore > now + 1000) {
      await ctx.scheduler.runAfter(message.notBefore - now, internal.outbound.send, { id })
      return null
    }

    // 3. One chat at a time: wait for anything queued earlier to the same person.
    const queued = await ctx.db
      .query('outboundMessages')
      .withIndex('by_seller_recipient_status', (q) =>
        q.eq('sellerId', message.sellerId).eq('recipient', message.recipient).eq('status', 'pending'),
      )
      .take(20)
    const earlier = queued.filter((m) => m._creationTime < message._creationTime)
    if (earlier.length > 0) {
      for (const lost of earlier.filter((m) => m.sendingAt !== undefined && now - m.sendingAt >= IN_FLIGHT_MS)) {
        await ctx.db.patch(lost._id, { sendingAt: undefined, sentAt: undefined })
        await ctx.scheduler.runAfter(0, internal.outbound.send, { id: lost._id })
      }
      await ctx.scheduler.runAfter(CHAT_ORDER_WAIT_MS, internal.outbound.send, { id })
      return null
    }

    const seller = await ctx.db.get(message.sellerId)
    const inbound = await lastInboundFrom(ctx, message)
    const wroteRecently = inbound !== null && now - inbound.receivedAt < REPLY_WINDOW_MS
    const linked = seller?.whatsappInstance !== undefined && seller.whatsappConnectedAt !== undefined

    // 1. Inbound only.
    if (message.via === 'sms' || !linked || !wroteRecently) {
      if (message.smsFallback) {
        await ctx.db.patch(id, { sendingAt: now })
        return { kind: 'sms', to: message.recipient, text: message.text }
      }
      await giveUp(ctx, message, !linked ? 'WhatsApp is not linked' : 'they haven’t written to you in the last 24 hours, so Stallo can’t message them first')
      return null
    }

    // 2. Hourly limit.
    const limit = hourlyLimit(seller!.whatsappConnectedAt!, now)
    const recent = await ctx.db
      .query('outboundMessages')
      .withIndex('by_seller_and_sent', (q) => q.eq('sellerId', message.sellerId).gt('sentAt', now - HOUR_MS))
      .take(limit)
    if (recent.length >= limit) {
      const notBefore = recent[0].sentAt! + HOUR_MS + 1000
      await ctx.db.patch(id, { notBefore })
      await ctx.scheduler.runAfter(notBefore - now, internal.outbound.send, { id })
      return null
    }

    await ctx.db.patch(id, { sendingAt: now, sentAt: now, notBefore: undefined })
    const raw = inbound!.raw as Partial<InboundWhatsAppMessage>
    return {
      kind: 'whatsapp',
      instance: seller!.whatsappInstance!,
      to: message.recipient,
      text: message.text,
      read: raw?.jid && raw.id ? { jid: raw.jid, id: raw.id } : null,
    }
  },
})

export const markSent = internalMutation({
  args: { id: v.id('outboundMessages'), via: v.union(v.literal('whatsapp'), v.literal('sms')), whatsappMessageId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, via, whatsappMessageId }) => {
    const message = await ctx.db.get(id)
    if (message === null || message.status !== 'pending') return null
    await ctx.db.patch(id, {
      status: 'done',
      via,
      whatsappMessageId: whatsappMessageId || undefined,
      error: undefined,
      sendingAt: undefined,
      // SMS doesn't count toward the WhatsApp limit.
      ...(via === 'sms' ? { sentAt: undefined } : {}),
    })
    return null
  },
})

export const markFailed = internalMutation({
  args: { id: v.id('outboundMessages'), error: v.string(), retryInMs: v.optional(v.number()), tryInstead: v.optional(v.literal('sms')) },
  returns: v.null(),
  handler: async (ctx, { id, error, retryInMs, tryInstead }) => {
    const message = await ctx.db.get(id)
    if (message === null || message.status !== 'pending') return null
    const attempts = (message.attempts ?? 0) + 1
    if (retryInMs !== undefined && attempts < MAX_ATTEMPTS) {
      await ctx.db.patch(id, { attempts, error, sendingAt: undefined, sentAt: undefined })
      await ctx.scheduler.runAfter(retryInMs, internal.outbound.send, { id })
      return null
    }
    // WhatsApp can't take it, but it must arrive: try SMS once.
    if (tryInstead === 'sms' && message.smsFallback && message.via !== 'sms') {
      await ctx.db.patch(id, { attempts, error, via: 'sms', sendingAt: undefined, sentAt: undefined })
      await ctx.scheduler.runAfter(0, internal.outbound.send, { id })
      return null
    }
    await giveUp(ctx, { ...message, attempts }, error)
    return null
  },
})

function backoff(attempt: number): number {
  return Math.min(60_000, 2000 * 2 ** attempt) + Math.floor(Math.random() * 1000)
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const send = internalAction({
  args: { id: v.id('outboundMessages') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const c = await ctx.runMutation(internal.outbound.claim, { id })
    if (c === null) return null

    if (c.kind === 'sms') {
      try {
        await sendSms(c.to, c.text)
        await ctx.runMutation(internal.outbound.markSent, { id, via: 'sms' })
      } catch (error) {
        const retryable = !(error instanceof SmsError) || error.code === 'UNAVAILABLE'
        await ctx.runMutation(internal.outbound.markFailed, { id, error: `SMS: ${errorText(error)}`, retryInMs: retryable ? backoff(1) : undefined })
      }
      return null
    }

    // Seen first; a failed read receipt never stops the reply.
    if (c.read) {
      try {
        await markRead(c.instance, c.read)
      } catch (error) {
        console.warn('Read receipt failed:', errorText(error))
      }
    }
    await ctx.scheduler.runAfter(700 + Math.floor(Math.random() * 800), internal.outbound.deliver, {
      id,
      instance: c.instance,
      to: c.to,
      text: c.text,
    })
    return null
  },
})

/** Typing…, then the text (Evolution shows typing for `delay` ms before sending). */
export const deliver = internalAction({
  args: { id: v.id('outboundMessages'), instance: v.string(), to: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, instance, to, text }) => {
    try {
      const whatsappMessageId = await sendText(instance, to, text, typingMs(text))
      await ctx.runMutation(internal.outbound.markSent, { id, via: 'whatsapp', whatsappMessageId })
    } catch (error) {
      const evolution = error instanceof EvolutionError ? error : null
      const retryable = evolution ? evolution.retryable : true
      await ctx.runMutation(internal.outbound.markFailed, {
        id,
        error: errorText(error),
        retryInMs: retryable ? backoff(0) : undefined,
        tryInstead: 'sms',
      })
    }
    return null
  },
})
