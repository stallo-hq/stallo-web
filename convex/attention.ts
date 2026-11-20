import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { assertOwned, requireSeller } from './model/auth'

/** Seller: mark a Needs attention item as handled. */
export const resolve = mutation({
  args: { id: v.id('attentionItems') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const seller = await requireSeller(ctx)
    const item = assertOwned(await ctx.db.get(id), seller, 'Item')
    if (!item.resolved) await ctx.db.patch(id, { resolved: true })
    return null
  },
})
