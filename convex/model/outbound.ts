import type { Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import { TEMPLATES, type TemplateName } from '../whatsapp/templates'

export type OutgoingMessage = {
  sellerId: Id<'sellers'>
  to: string
  /** Free-form text, used when the 24-hour window is open. */
  text?: string
  /** Approved template, used outside the window (or always, if there is no text). */
  template?: { name: TemplateName; params: string[] }
  orderId?: Id<'orders'>
  /** Keeps several messages from one step in order. */
  delayMs?: number
}

/**
 * Queues a WhatsApp message. The only way anything is sent: it's stored first,
 * then sent by outbound.send, which retries and records failures.
 * Messages to sellers go from Stallo's own number and are skipped when that isn't set up.
 */
export async function queueMessage(ctx: MutationCtx, message: OutgoingMessage): Promise<Id<'outboundMessages'> | null> {
  const channel = message.template ? TEMPLATES[message.template.name].channel : 'seller'
  if (channel === 'platform' && !process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID) return null
  if (message.template && message.template.params.length !== TEMPLATES[message.template.name].params) {
    throw new Error(`Template ${message.template.name} needs ${TEMPLATES[message.template.name].params} parameters`)
  }
  const id = await ctx.db.insert('outboundMessages', {
    sellerId: message.sellerId,
    channel,
    recipient: message.to,
    text: message.text,
    template: message.template?.name,
    templateParams: message.template?.params,
    orderId: message.orderId,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  })
  await ctx.scheduler.runAfter(message.delayMs ?? 0, internal.outbound.send, { id })
  return id
}

/** Queues several messages to go out in the given order. */
export async function queueInOrder(ctx: MutationCtx, messages: OutgoingMessage[]): Promise<void> {
  let delayMs = 0
  for (const message of messages) {
    await queueMessage(ctx, { ...message, delayMs })
    delayMs += 1500
  }
}
