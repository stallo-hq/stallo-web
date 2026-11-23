import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { textSeller } from './alerts'
import { copy } from './copy'

/**
 * Adds an item to the seller's Needs attention list, and texts the seller when
 * asked to. Doesn't repeat an open item of the same kind for the same order.
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
    if (seller) await textSeller(ctx, seller, copy.sellerAttention(item.summary))
  }
}
