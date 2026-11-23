import type { Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'

export type OutgoingMessage = {
  sellerId: Id<'sellers'>
  to: string
  text: string
  /**
   * The person must get this even if they haven't written recently (delivery code,
   * delivered, cancelled). Without it, a message WhatsApp may not carry is dropped
   * into Needs attention instead (ADR 0002: Stallo only replies on WhatsApp).
   */
  smsFallback?: boolean
  /** Always by SMS: riders, receivers and the seller's own alerts, who haven't written to the seller's WhatsApp. */
  via?: 'sms'
  orderId?: Id<'orders'>
  /** Keeps several messages from one step in order. */
  delayMs?: number
}

/**
 * Queues a message (WhatsApp from the seller's number, or SMS). The only way
 * anything is sent: it's stored first, then sent by outbound.send, which checks
 * the inbound-only rule and the hourly limit, retries, and records failures.
 */
export async function queueMessage(ctx: MutationCtx, message: OutgoingMessage): Promise<Id<'outboundMessages'>> {
  const id = await ctx.db.insert('outboundMessages', {
    sellerId: message.sellerId,
    channel: 'seller',
    recipient: message.to,
    text: message.text,
    ...(message.smsFallback || message.via === 'sms' ? { smsFallback: true } : {}),
    ...(message.via === 'sms' ? { via: 'sms' as const } : {}),
    orderId: message.orderId,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  })
  await ctx.scheduler.runAfter(message.delayMs ?? 0, internal.outbound.send, { id })
  return id
}

/** Queues several messages to go out in the given order (outbound.send also keeps each chat in order). */
export async function queueInOrder(ctx: MutationCtx, messages: OutgoingMessage[]): Promise<void> {
  let delayMs = 0
  for (const message of messages) {
    await queueMessage(ctx, { ...message, delayMs })
    delayMs += 1500
  }
}
