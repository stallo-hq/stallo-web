import { DEFAULT_MIN_PASSWORD_LENGTH } from '@convex-dev/auth/methods/username-password'
import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { components } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { toE164Ghana } from './lib/phone'
import { findSellerForUser, requireUserId } from './model/auth'
import { consumePhoneToken } from './model/verification'
import { passwordMessage } from './lib/authMessages'

/** Where the signed-in user is in sign-up. Null when signed out. */
export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ phone: v.union(v.string(), v.null()), phoneVerified: v.boolean(), hasSeller: v.boolean() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null
    const user = await ctx.db.get(userId as Id<'users'>)
    const phone = await ctx.runQuery(components.authUsername.public.getUsername, { userId })
    const seller = await findSellerForUser(ctx, userId as Id<'users'>)
    return { phone, phoneVerified: user?.phoneVerifiedAt !== undefined, hasSeller: seller !== null }
  },
})

/** Whether an account exists for this number, so sign-up can point people to sign-in instead. */
export const exists = query({
  args: { phone: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const phone = toE164Ghana(args.phone)
    if (phone === null) return false
    return (await ctx.runQuery(components.authUsername.public.getUserIdByUsername, { username: phone })) !== null
  },
})

/** Marks the signed-in user's phone as verified, using the token from the SMS check. */
export const confirmPhone = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const userId = await requireUserId(ctx)
    const phone = await ctx.runQuery(components.authUsername.public.getUsername, { userId })
    if (phone === null) throw new ConvexError({ code: 'NO_PHONE', message: 'This account has no phone number.' })
    await consumePhoneToken(ctx, token, phone)
    await ctx.db.patch(userId, { phoneVerifiedAt: Date.now() })
    return null
  },
})

/**
 * Forgot password: with a token proving they hold the number, set a new
 * password and sign out every existing session. The client then signs in.
 */
export const resetPassword = mutation({
  args: { phone: v.string(), token: v.string(), newPassword: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), message: v.string() })),
  handler: async (ctx, args) => {
    const phone = toE164Ghana(args.phone)
    if (phone === null) return { ok: false as const, message: 'Enter a Ghana mobile number.' }
    const userId = await ctx.runQuery(components.authUsername.public.getUserIdByUsername, { username: phone })
    if (userId === null) return { ok: false as const, message: 'There is no account for this number. Create one instead.' }

    await consumePhoneToken(ctx, args.token, phone)
    const result = await ctx.runMutation(components.authPassword.public._internal_dangerous_setPassword, {
      userId,
      password: args.newPassword,
      minimumLength: DEFAULT_MIN_PASSWORD_LENGTH,
    })
    if (!result.success) return { ok: false as const, message: passwordMessage(result.userError.error) }

    const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId })
    await ctx.runMutation(components.auth.public.revokeSessions, { sessionIds: sessions.map((s) => s.sessionId) })
    await ctx.db.patch(userId as Id<'users'>, { phoneVerifiedAt: Date.now() })
    return { ok: true as const }
  },
})
