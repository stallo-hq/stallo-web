import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { queueMessage } from './outbound'

/**
 * Tells the seller something urgent by SMS (SasuSync). Stallo never starts
 * WhatsApp chats and has no WhatsApp number of its own (ADR 0002), so alerts go
 * by SMS; the dashboard shows the same thing live.
 */
export async function textSeller(ctx: MutationCtx, seller: Pick<Doc<'sellers'>, '_id' | 'phone'>, text: string): Promise<void> {
  await queueMessage(ctx, { sellerId: seller._id, to: seller.phone, text, via: 'sms' })
}
