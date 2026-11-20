import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { queueMessage } from './outbound'

/**
 * Adds an item to the seller's Needs attention list, and tells them on
 * WhatsApp when asked to (only if Stallo's own number is set up). Doesn't
 * repeat an open item of the same kind for the same order.
 */
export async function raiseAttention(
  ctx: MutationCtx,
  item: {
    sellerId: Id<'sellers'>
    type: Doc<'attentionItems'>['type']
    summary: string
    orderId?: Id<'orders'>
    inboundMessageId?: Id<'inboundMessages'>
    notify?: boolean
  },
): Promise<void> {
  if (item.orderId !== undefined) {
    const open = await ctx.db
      .query('attentionItems')
      .withIndex('by_order', (q) => q.eq('orderId', item.orderId))
      .take(50)
    if (open.some((a) => !a.resolved && a.type === item.type)) return
  }
  await ctx.db.insert('attentionItems', {
    sellerId: item.sellerId,
    type: item.type,
    orderId: item.orderId,
    inboundMessageId: item.inboundMessageId,
    summary: item.summary.slice(0, 500),
    resolved: false,
    createdAt: Date.now(),
  })
  if (item.notify) {
    const seller = await ctx.db.get(item.sellerId)
    if (seller) {
      await queueMessage(ctx, {
        sellerId: seller._id,
        to: seller.phone,
        template: { name: 'stallo_seller_attention', params: [item.summary.slice(0, 200)] },
      })
    }
  }
}
