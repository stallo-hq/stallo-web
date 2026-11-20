import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalMutation, internalQuery, mutation } from './_generated/server'
import {
  WhatsAppError,
  exchangeCode,
  getPhoneNumber,
  platformToken,
  registerNumber,
  subscribeApp,
} from './integrations/whatsapp'
import { toE164 } from './lib/phone'
import { requireSeller } from './model/auth'
import { randomDigits } from './model/crypto'

/**
 * Connecting a seller's WhatsApp number.
 *  - Embedded Signup: the seller logs in to Meta in a popup; we get a code and the
 *    number's ids, swap the code for a token, subscribe to webhooks and register the number.
 *  - Manual (testing): connect a number that already sits in Stallo's own Meta
 *    account, e.g. Meta's free test number. Only when WHATSAPP_MANUAL_CONNECT=true.
 */

export const callerSeller = internalQuery({
  args: {},
  returns: v.object({ _id: v.id('sellers') }),
  handler: async (ctx) => ({ _id: (await requireSeller(ctx))._id }),
})

export const save = internalMutation({
  args: {
    phoneNumberId: v.string(),
    wabaId: v.optional(v.string()),
    displayPhone: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seller = await requireSeller(ctx)
    const taken = await ctx.db
      .query('sellers')
      .withIndex('by_whatsapp_phone_number_id', (q) => q.eq('whatsappPhoneNumberId', args.phoneNumberId))
      .first()
    if (taken && taken._id !== seller._id) throw new ConvexError('This WhatsApp number is already connected to another business.')
    await ctx.db.patch(seller._id, {
      whatsappPhoneNumberId: args.phoneNumberId,
      whatsappBusinessAccountId: args.wabaId,
      whatsappDisplayPhone: args.displayPhone,
      whatsappConnectedAt: Date.now(),
      onboarding: seller.paystackSubaccountCode ? 'done' : 'payouts',
    })
    const secret = await ctx.db
      .query('sellerSecrets')
      .withIndex('by_seller', (q) => q.eq('sellerId', seller._id))
      .unique()
    if (secret) await ctx.db.patch(secret._id, { whatsappToken: args.token })
    else await ctx.db.insert('sellerSecrets', { sellerId: seller._id, whatsappToken: args.token })
    return null
  },
})

function friendly(error: unknown): ConvexError<string> {
  if (error instanceof ConvexError) return error
  if (error instanceof WhatsAppError) {
    if (error.kind === 'not_configured') return new ConvexError('WhatsApp isn’t set up on Stallo yet. Please try again later.')
    return new ConvexError(`Meta said: ${error.message}`)
  }
  return new ConvexError('Something went wrong talking to Meta. Please try again.')
}

export const completeSignup = action({
  args: {
    code: v.string(),
    phoneNumberId: v.string(),
    wabaId: v.string(),
    keepBusinessApp: v.boolean(),
  },
  returns: v.object({ displayPhone: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.whatsappConnect.callerSeller, {})
    if (!/^\d{5,30}$/.test(args.phoneNumberId) || !/^\d{5,30}$/.test(args.wabaId)) {
      throw new ConvexError('Meta didn’t return the number’s details. Please try again.')
    }
    try {
      const token = await exchangeCode(args.code)
      await subscribeApp(args.wabaId, token)
      // Numbers that stay on the WhatsApp Business app (coexistence) are already registered.
      if (!args.keepBusinessApp) {
        try {
          await registerNumber(args.phoneNumberId, token, randomDigits(6))
        } catch (error) {
          if (!(error instanceof WhatsAppError && /already registered/i.test(error.message))) throw error
        }
      }
      const number = await getPhoneNumber(args.phoneNumberId, token)
      const displayPhone = number.display_phone_number ? toE164(number.display_phone_number) : undefined
      await ctx.runMutation(internal.whatsappConnect.save, {
        phoneNumberId: args.phoneNumberId,
        wabaId: args.wabaId,
        displayPhone,
        token,
      })
      return { displayPhone: displayPhone ?? null }
    } catch (error) {
      throw friendly(error)
    }
  },
})

export const connectManually = action({
  args: { phoneNumberId: v.string() },
  returns: v.object({ displayPhone: v.union(v.string(), v.null()) }),
  handler: async (ctx, { phoneNumberId }) => {
    await ctx.runQuery(internal.whatsappConnect.callerSeller, {})
    if (process.env.WHATSAPP_MANUAL_CONNECT !== 'true') throw new ConvexError('Manual connection is turned off.')
    const id = phoneNumberId.trim()
    if (!/^\d{5,30}$/.test(id)) throw new ConvexError('The Phone number ID is a long number from Meta’s WhatsApp settings.')
    try {
      const number = await getPhoneNumber(id, platformToken())
      const displayPhone = number.display_phone_number ? toE164(number.display_phone_number) : undefined
      await ctx.runMutation(internal.whatsappConnect.save, { phoneNumberId: id, displayPhone })
      return { displayPhone: displayPhone ?? null }
    } catch (error) {
      throw friendly(error)
    }
  },
})

export const disconnect = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const seller = await requireSeller(ctx)
    await ctx.db.patch(seller._id, {
      whatsappPhoneNumberId: undefined,
      whatsappBusinessAccountId: undefined,
      whatsappDisplayPhone: undefined,
      whatsappConnectedAt: undefined,
    })
    const secret = await ctx.db
      .query('sellerSecrets')
      .withIndex('by_seller', (q) => q.eq('sellerId', seller._id))
      .unique()
    if (secret) await ctx.db.patch(secret._id, { whatsappToken: undefined })
    return null
  },
})
