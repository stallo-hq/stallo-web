import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { assertOwned, requireSeller } from './model/auth'

/**
 * Seller: let Stallo answer this order's customer again straight away, instead of
 * waiting for the quiet period after the seller's own reply to run out.
 */
export const letStalloReply = mutation({
  args: { orderId: v.id('orders') },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const seller = await requireSeller(ctx)
    const order = assertOwned(await ctx.db.get(orderId), seller, 'Order')
    const conversation = await ctx.db
      .query('conversations')
      .withIndex('by_seller_and_customer', (q) => q.eq('sellerId', seller._id).eq('customerId', order.customerId))
      .unique()
    if (conversation?.sellerActiveUntil !== undefined) await ctx.db.patch(conversation._id, { sellerActiveUntil: undefined })
    return null
  },
})
