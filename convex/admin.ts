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

/**
 * One-off after moving from Meta's Cloud API to Evolution API (ADR 0002): empties
 * the Meta fields and marks Meta-connected sellers as not linked, so they link
 * again by QR code. Safe to run more than once.
 * Run: npx convex run admin:clearMetaFields
 */
export const clearMetaFields = internalMutation({
  args: {},
  returns: v.object({ sellers: v.number(), secrets: v.number() }),
  handler: async (ctx) => {
    let sellers = 0
    for (const seller of await ctx.db.query('sellers').take(5000)) {
      const meta = seller.whatsappPhoneNumberId !== undefined || seller.whatsappBusinessAccountId !== undefined
      const linkedWithoutSession = seller.whatsappConnectedAt !== undefined && seller.whatsappInstance === undefined
      if (!meta && !linkedWithoutSession) continue
      await ctx.db.patch(seller._id, {
        whatsappPhoneNumberId: undefined,
        whatsappBusinessAccountId: undefined,
        ...(linkedWithoutSession ? { whatsappConnectedAt: undefined } : {}),
      })
      sellers++
    }
    let secrets = 0
    for (const secret of await ctx.db.query('sellerSecrets').take(5000)) {
      await ctx.db.delete(secret._id)
      secrets++
    }
    return { sellers, secrets }
  },
})
