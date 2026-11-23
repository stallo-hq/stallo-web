import { ConvexError, v } from 'convex/values'
import { components } from './_generated/api'
import { mutation, query } from './_generated/server'
import { payoutType } from './lib/validators'
import { currentSeller, findSellerForUser, requireSeller, requireUserId } from './model/auth'
import { cleanText, LIMITS } from './model/validation'

const sellerView = v.object({
  _id: v.id('sellers'),
  businessName: v.string(),
  phone: v.string(),
  deliveryAreas: v.optional(v.string()),
  deliveryFeePesewas: v.number(),
  acceptsCash: v.boolean(),
  feeBalancePesewas: v.number(),
  whatsappConnected: v.boolean(),
  whatsappDisplayPhone: v.optional(v.string()),
  payoutsConnected: v.boolean(),
  payout: v.optional(
    v.object({ type: payoutType, providerName: v.string(), accountLast4: v.string(), accountName: v.optional(v.string()) }),
  ),
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
      deliveryAreas: seller.deliveryAreas,
      deliveryFeePesewas: seller.deliveryFeePesewas ?? 0,
      acceptsCash: seller.acceptsCash === true,
      feeBalancePesewas: seller.feeBalancePesewas ?? 0,
      whatsappConnected: seller.whatsappConnectedAt !== undefined,
      whatsappDisplayPhone: seller.whatsappDisplayPhone,
      payoutsConnected: seller.paystackSubaccountCode !== undefined,
      payout: seller.payout,
    }
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

/** Where the seller delivers, in their own words. Empty = anywhere (no area check). */
export const updateDeliveryAreas = mutation({
  args: { deliveryAreas: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seller = await requireSeller(ctx)
    const deliveryAreas = cleanText(args.deliveryAreas, 'Delivery areas', LIMITS.deliveryAreas)
    await ctx.db.patch(seller._id, { deliveryAreas: deliveryAreas || undefined })
    return null
  },
})

const MAX_DELIVERY_FEE_PESEWAS = 100_000 // GH₵ 1,000

/** Delivery fee added to every order, and whether customers may pay the rider in cash. */
export const updateDeliveryAndPayment = mutation({
  args: { deliveryFeePesewas: v.number(), acceptsCash: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { deliveryFeePesewas, acceptsCash }) => {
    const seller = await requireSeller(ctx)
    if (!Number.isInteger(deliveryFeePesewas) || deliveryFeePesewas < 0 || deliveryFeePesewas > MAX_DELIVERY_FEE_PESEWAS) {
      throw new ConvexError('Enter a delivery fee from 0 to 1,000 cedis.')
    }
    await ctx.db.patch(seller._id, { deliveryFeePesewas, acceptsCash })
    return null
  },
})
