import { ConvexError, v } from 'convex/values'
import { components } from './_generated/api'
import { mutation, query } from './_generated/server'
import { currentSeller, findSellerForUser, requireSeller, requireUserId } from './model/auth'
import { cleanText, LIMITS } from './model/validation'

const sellerView = v.object({
  _id: v.id('sellers'),
  businessName: v.string(),
  phone: v.string(),
  whatsappConnected: v.boolean(),
  payoutsConnected: v.boolean(),
  whatsappSetupRequestedAt: v.optional(v.number()),
  payoutsSetupRequestedAt: v.optional(v.number()),
})

/** The signed-in user's seller profile, or null if they haven't set one up yet. */
export const mine = query({
  args: {},
  returns: v.union(sellerView, v.null()),
  handler: async (ctx) => {
    const seller = await currentSeller(ctx)
    if (seller === null) return null
    return {
      _id: seller._id,
      businessName: seller.businessName,
      phone: seller.phone,
      whatsappConnected: seller.whatsappPhoneNumberId !== undefined,
      payoutsConnected: seller.paystackSubaccountCode !== undefined,
      whatsappSetupRequestedAt: seller.whatsappSetupRequestedAt,
      payoutsSetupRequestedAt: seller.payoutsSetupRequestedAt,
    }
  },
})

/** Ask the Stallo team to connect WhatsApp or payouts. Idempotent: keeps the first request time. */
export const requestSetup = mutation({
  args: { kind: v.union(v.literal('whatsapp'), v.literal('payouts')) },
  returns: v.null(),
  handler: async (ctx, { kind }) => {
    const seller = await requireSeller(ctx)
    const field = kind === 'whatsapp' ? 'whatsappSetupRequestedAt' : 'payoutsSetupRequestedAt'
    if (seller[field] === undefined) await ctx.db.patch(seller._id, { [field]: Date.now() })
    return null
  },
})

/** First-run setup: create the seller profile for the signed-in user. Idempotent. */
export const create = mutation({
  args: { businessName: v.string() },
  returns: v.id('sellers'),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const businessName = cleanText(args.businessName, 'Business name', LIMITS.businessName)

    const existing = await findSellerForUser(ctx, userId)
    if (existing !== null) return existing._id

    const user = await ctx.db.get(userId)
    if (user?.phoneVerifiedAt === undefined) {
      throw new ConvexError({ code: 'PHONE_NOT_VERIFIED', message: 'Confirm your phone number first.' })
    }

    // The phone number they signed up with is their username.
    const phone = await ctx.runQuery(components.authUsername.public.getUsername, { userId })
    if (phone === null) throw new ConvexError('Account has no phone number')

    return await ctx.db.insert('sellers', {
      ownerId: userId,
      businessName,
      phone,
      onboarding: 'whatsapp',
    })
  },
})

export const updateBusinessName = mutation({
  args: { businessName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seller = await requireSeller(ctx)
    const businessName = cleanText(args.businessName, 'Business name', LIMITS.businessName)
    await ctx.db.patch(seller._id, { businessName })
    return null
  },
})
