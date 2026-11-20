import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalMutation, internalQuery } from './_generated/server'
import { PaystackError, createSubaccount, listBanks, paystackConfigured, updateSubaccount } from './integrations/paystack'
import { payoutType } from './lib/validators'
import { requireSeller } from './model/auth'

/**
 * Where a seller's money goes: a Paystack subaccount for their mobile money
 * wallet or bank account. Paystack pays the seller's share out to it.
 */

export const providers = action({
  args: { type: payoutType },
  returns: v.object({
    configured: v.boolean(),
    providers: v.array(v.object({ name: v.string(), code: v.string() })),
  }),
  handler: async (ctx, { type }) => {
    await ctx.runQuery(internal.payouts.callerSeller, {})
    if (!paystackConfigured()) return { configured: false, providers: [] }
    try {
      return { configured: true, providers: await listBanks(type === 'bank' ? 'ghipss' : 'mobile_money') }
    } catch (error) {
      throw new ConvexError(`Couldn’t load the list from Paystack: ${error instanceof Error ? error.message : 'try again'}`)
    }
  },
})

export const callerSeller = internalQuery({
  args: {},
  returns: v.object({
    _id: v.id('sellers'),
    businessName: v.string(),
    phone: v.string(),
    subaccount: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const seller = await requireSeller(ctx)
    return {
      _id: seller._id,
      businessName: seller.businessName,
      phone: seller.phone,
      subaccount: seller.paystackSubaccountCode ?? null,
    }
  },
})

export const save = internalMutation({
  args: {
    subaccount: v.string(),
    type: payoutType,
    providerName: v.string(),
    accountLast4: v.string(),
    accountName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seller = await requireSeller(ctx)
    await ctx.db.patch(seller._id, {
      paystackSubaccountCode: args.subaccount,
      payout: {
        type: args.type,
        providerName: args.providerName,
        accountLast4: args.accountLast4,
        accountName: args.accountName,
      },
      onboarding: seller.whatsappPhoneNumberId ? 'done' : seller.onboarding,
    })
    return null
  },
})

export const connect = action({
  args: {
    type: payoutType,
    providerCode: v.string(),
    providerName: v.string(),
    accountNumber: v.string(),
  },
  returns: v.object({ accountName: v.union(v.string(), v.null()) }),
  handler: async (ctx, args): Promise<{ accountName: string | null }> => {
    const seller: { businessName: string; phone: string; subaccount: string | null } = await ctx.runQuery(internal.payouts.callerSeller, {})
    if (!paystackConfigured()) throw new ConvexError('Payments aren’t set up on Stallo yet. Please try again later.')

    const accountNumber = args.accountNumber.replace(/[\s-]/g, '')
    // Mobile money wallets are phone numbers (0241234567); bank accounts are 8–20 digits.
    const valid = args.type === 'mobile_money' ? /^0\d{9}$/.test(accountNumber) : /^\d{8,20}$/.test(accountNumber)
    if (!valid) {
      throw new ConvexError(
        args.type === 'mobile_money' ? 'Enter the wallet number as 10 digits, e.g. 0241234567.' : 'Enter a valid account number.',
      )
    }
    const providerCode = args.providerCode.trim()
    const providerName = args.providerName.trim().slice(0, 80)
    if (!providerCode || !providerName) throw new ConvexError('Choose your provider.')

    try {
      const input = { businessName: seller.businessName, bankCode: providerCode, accountNumber }
      const sub = seller.subaccount
        ? await updateSubaccount(seller.subaccount, input)
        : await createSubaccount({ ...input, phone: seller.phone })
      const accountName = sub.account_name?.trim() || undefined
      await ctx.runMutation(internal.payouts.save, {
        subaccount: sub.subaccount_code ?? seller.subaccount!,
        type: args.type,
        providerName,
        accountLast4: accountNumber.slice(-4),
        accountName,
      })
      return { accountName: accountName ?? null }
    } catch (error) {
      if (error instanceof PaystackError) throw new ConvexError(`Paystack said: ${error.message}`)
      throw error
    }
  },
})
