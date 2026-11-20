import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

/**
 * Stallo team only (internal: never callable from the browser). Marks a
 * seller's phone as confirmed, e.g. for accounts made before SMS checks existed.
 * Run: npx convex run admin:markPhoneVerified '{"phone":"+233..."}'
 */
export const markPhoneVerified = internalMutation({
  args: { phone: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { phone }) => {
    const sellers = await ctx.db.query('sellers').take(1000)
    const seller = sellers.find((s) => s.phone === phone)
    if (!seller) return false
    await ctx.db.patch(seller.ownerId, { phoneVerifiedAt: Date.now() })
    return true
  },
})
