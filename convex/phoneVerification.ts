import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalMutation } from './_generated/server'
import { SmsError, sendOtp, verifyOtp } from './integrations/sasusync'
import { toE164Ghana } from './lib/phone'
import { DEFAULT_SENDS_PER_HOUR, SENDS_PER_PHONE_PER_HOUR, randomToken, sha256 } from './model/verification'

/*
 * Phone verification by SMS code. Public actions, because they call SasuSync.
 * Errors are ConvexError({ code, message }) with a message fit to show the user.
 */

const HOUR = 60 * 60 * 1000

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message })
}

function parsePhone(input: string): string {
  return toE164Ghana(input) ?? fail('INVALID_PHONE', 'Enter a Ghana mobile number, for example 024 123 4567.')
}

function smsFailure(error: unknown): never {
  if (error instanceof SmsError) {
    console.error(`SasuSync ${error.code}: ${error.message}`)
    if (error.code === 'CODE_PENDING') fail('CODE_PENDING', 'We sent you a code a moment ago. Use that one, or wait a few minutes for a new one.')
    if (error.code === 'NOT_CONFIGURED') fail('SMS_UNAVAILABLE', 'Text messages are not set up yet. Please contact Stallo support.')
  }
  fail('SMS_UNAVAILABLE', 'We couldn’t send the text message. Try again in a minute.')
}

/** Sends a 6-digit code by SMS. Rate-limited per number and overall. */
export const sendCode = action({
  args: { phone: v.string() },
  returns: v.object({ phone: v.string() }),
  handler: async (ctx, args): Promise<{ phone: string }> => {
    const phone = parsePhone(args.phone)
    const id = await ctx.runMutation(internal.phoneVerification.startSend, { phone })
    try {
      const otpId = await sendOtp(phone)
      await ctx.runMutation(internal.phoneVerification.finishSend, { id, otpId })
    } catch (error) {
      // A live code already exists for this number: the user can type that one.
      if (error instanceof SmsError && error.code === 'CODE_PENDING') {
        await ctx.runMutation(internal.phoneVerification.finishSend, { id, otpId: 'pending' })
        return { phone }
      }
      await ctx.runMutation(internal.phoneVerification.finishSend, {
        id,
        error: error instanceof Error ? error.message : 'unknown',
      })
      smsFailure(error)
    }
    return { phone }
  },
})

/** Checks the code. On success returns a one-time token proving the user holds this number. */
export const verifyCode = action({
  args: { phone: v.string(), code: v.string() },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args): Promise<{ token: string }> => {
    const phone = parsePhone(args.phone)
    const code = args.code.replace(/\s/g, '')
    if (!/^\d{4,8}$/.test(code)) fail('WRONG_CODE', 'Enter the 6-digit code from the text message.')

    let result
    try {
      result = await verifyOtp(phone, code)
    } catch (error) {
      smsFailure(error)
    }
    if (result === 'wrong_code') fail('WRONG_CODE', 'That code isn’t right. Check the message and try again.')
    if (result === 'expired' || result === 'no_pending_code') fail('EXPIRED', 'That code has expired. Get a new one.')

    const token = randomToken()
    await ctx.runMutation(internal.phoneVerification.markVerified, { phone, tokenHash: await sha256(token) })
    return { token }
  },
})

export const startSend = internalMutation({
  args: { phone: v.string() },
  returns: v.id('phoneVerifications'),
  handler: async (ctx, { phone }) => {
    const since = Date.now() - HOUR
    const recentForPhone = await ctx.db
      .query('phoneVerifications')
      .withIndex('by_phone', (q) => q.eq('phone', phone).gt('_creationTime', since))
      .take(SENDS_PER_PHONE_PER_HOUR)
    if (recentForPhone.length >= SENDS_PER_PHONE_PER_HOUR) {
      fail('TOO_MANY', 'Too many codes for this number. Try again in an hour.')
    }
    const limit = Number(process.env.SMS_HOURLY_LIMIT ?? DEFAULT_SENDS_PER_HOUR)
    const recentOverall = await ctx.db
      .query('phoneVerifications')
      .withIndex('by_creation_time', (q) => q.gt('_creationTime', since))
      .take(limit)
    if (recentOverall.length >= limit) {
      console.error('SMS hourly limit reached; raise SMS_HOURLY_LIMIT if this is real demand.')
      fail('TOO_MANY', 'We’re sending a lot of codes right now. Try again in a few minutes.')
    }
    return await ctx.db.insert('phoneVerifications', { phone, status: 'sending' })
  },
})

export const finishSend = internalMutation({
  args: { id: v.id('phoneVerifications'), otpId: v.optional(v.string()), error: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, otpId, error }) => {
    await ctx.db.patch(id, error === undefined ? { status: 'sent', otpId } : { status: 'failed', error })
    return null
  },
})

export const markVerified = internalMutation({
  args: { phone: v.string(), tokenHash: v.string() },
  returns: v.null(),
  handler: async (ctx, { phone, tokenHash }) => {
    await ctx.db.insert('phoneVerifications', { phone, status: 'verified', tokenHash, verifiedAt: Date.now() })
    return null
  },
})
