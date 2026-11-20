import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { components } from './_generated/api'
import { mutation, query } from './_generated/server'

const sellerView = v.object({
  _id: v.id('sellers'),
  businessName: v.string(),
  phone: v.string(),
  onboarding: v.string(),
  whatsappConnected: v.boolean(),
  payoutsConnected: v.boolean(),
})

/** The signed-in user's seller profile, or null if they haven't set one up yet. */
export const mine = query({
  args: {},
  returns: v.union(sellerView, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null
    const seller = await ctx.db
      .query('sellers')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique()
    if (seller === null) return null
    return {
      _id: seller._id,
      businessName: seller.businessName,
      phone: seller.phone,
      onboarding: seller.onboarding,
      whatsappConnected: seller.whatsappPhoneNumberId !== undefined,
      payoutsConnected: seller.paystackSubaccountCode !== undefined,
    }
  },
})

/** First-run setup: create the seller profile for the signed-in user. */
export const create = mutation({
  args: { businessName: v.string() },
  returns: v.id('sellers'),
  handler: async (ctx, { businessName }) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) throw new ConvexError('Not signed in')

    const name = businessName.trim()
    if (name.length < 2 || name.length > 80) {
      throw new ConvexError('Business name must be 2 to 80 characters')
    }

    const existing = await ctx.db
      .query('sellers')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique()
    if (existing !== null) return existing._id

    // The phone number they signed up with is their username.
    const phone = await ctx.runQuery(components.authUsername.public.getUsername, { userId })
    if (phone === null) throw new ConvexError('Account has no phone number')

    return await ctx.db.insert('sellers', {
      ownerId: userId,
      businessName: name,
      phone,
      onboarding: 'whatsapp',
    })
  },
})

/** Rename the business from Settings. */
export const updateBusinessName = mutation({
  args: { businessName: v.string() },
  returns: v.null(),
  handler: async (ctx, { businessName }) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) throw new ConvexError('Not signed in')
    const seller = await ctx.db
      .query('sellers')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique()
    if (seller === null) throw new ConvexError('No seller profile')

    const name = businessName.trim()
    if (name.length < 2 || name.length > 80) {
      throw new ConvexError('Business name must be 2 to 80 characters')
    }
    await ctx.db.patch(seller._id, { businessName: name })
    return null
  },
})
