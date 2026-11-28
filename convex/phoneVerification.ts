import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { action, internalMutation } from './_generated/server'
import { SmsError, sendOtp, verifyOtp } from './integrations/sasusync'
import { toE164Ghana } from './lib/phone'
import {
  DEFAULT_SENDS_PER_HOUR,
  SENDS_PER_PHONE_PER_HOUR,
  WRONG_GUESSES_PER_CODE,
  WRONG_GUESSES_PER_PHONE_PER_HOUR,
  randomToken,
  sha256,
} from './model/verification'

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

    // Counted before asking SasuSync, so parallel guesses can't slip past the limit.
    const guess = await ctx.runMutation(internal.phoneVerification.startGuess, { phone })

    let result
    try {
      result = await verifyOtp(phone, code)
    } catch (error) {
      await ctx.runMutation(internal.phoneVerification.finishGuess, { id: guess, outcome: 'failed' })
      smsFailure(error)
    }
    if (result === 'wrong_code') {
      await ctx.runMutation(internal.phoneVerification.finishGuess, { id: guess, outcome: 'wrong' })
      fail('WRONG_CODE', 'That code isn’t right. Check the message and try again.')
    }
    if (result === 'expired' || result === 'no_pending_code') {
      await ctx.runMutation(internal.phoneVerification.finishGuess, { id: guess, outcome: 'failed' })
      fail('EXPIRED', 'That code has expired. Get a new one.')
    }

    const token = randomToken()
    await ctx.runMutation(internal.phoneVerification.finishGuess, { id: guess, outcome: 'verified', tokenHash: await sha256(token) })
    return { token }
  },
})

/** A row for a code sent, being sent, or that failed to send (send failures carry an error). */
function isSend(r: Doc<'phoneVerifications'>): boolean {
  return r.status === 'sending' || r.status === 'sent' || (r.status === 'failed' && r.error !== undefined)
}

export const startSend = internalMutation({
  args: { phone: v.string() },
  returns: v.id('phoneVerifications'),
  handler: async (ctx, { phone }) => {
    const since = Date.now() - HOUR
    // Only codes sent (or tried and failed to send) count; guesses have their own limit.
    const recentForPhone = (
      await ctx.db
        .query('phoneVerifications')
        .withIndex('by_phone', (q) => q.eq('phone', phone).gt('_creationTime', since))
        .collect()
    ).filter(isSend)
    if (recentForPhone.length >= SENDS_PER_PHONE_PER_HOUR) {
      fail('TOO_MANY', 'Too many codes for this number. Try again in an hour.')
    }
    const limit = Number(process.env.SMS_HOURLY_LIMIT ?? DEFAULT_SENDS_PER_HOUR)
    // Bounded: sends are capped by this limit, and guesses need a code sent in the last hour.
    const recentOverall = (
      await ctx.db
        .query('phoneVerifications')
        .withIndex('by_creation_time', (q) => q.gt('_creationTime', since))
        .collect()
    ).filter(isSend)
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

/**
 * Records a code guess before it is checked, or refuses it: at most WRONG_GUESSES_PER_CODE
 * since the last code was sent, and WRONG_GUESSES_PER_PHONE_PER_HOUR for the number.
 */
export const startGuess = internalMutation({
  args: { phone: v.string() },
  returns: v.id('phoneVerifications'),
  handler: async (ctx, { phone }) => {
    const recent = await ctx.db
      .query('phoneVerifications')
      .withIndex('by_phone', (q) => q.eq('phone', phone).gt('_creationTime', Date.now() - HOUR))
      .collect()
    const isGuess = (r: (typeof recent)[number]) => r.status === 'checking' || r.status === 'wrong'
    if (recent.filter(isGuess).length >= WRONG_GUESSES_PER_PHONE_PER_HOUR) {
      fail('TOO_MANY', 'Too many wrong codes for this number. Try again in an hour.')
    }
    let lastSent = -1
    recent.forEach((r, i) => {
      if (r.status === 'sent') lastSent = i
    })
    if (lastSent === -1) fail('EXPIRED', 'That code has expired. Get a new one.')
    if (recent.slice(lastSent + 1).filter(isGuess).length >= WRONG_GUESSES_PER_CODE) {
      fail('EXPIRED', 'Too many wrong tries for this code. Get a new one.')
    }
    return await ctx.db.insert('phoneVerifications', { phone, status: 'checking' })
  },
})

export const finishGuess = internalMutation({
  args: {
    id: v.id('phoneVerifications'),
    outcome: v.union(v.literal('wrong'), v.literal('failed'), v.literal('verified')),
    tokenHash: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, outcome, tokenHash }) => {
    if (outcome === 'verified') {
      await ctx.db.patch(id, { status: 'verified', tokenHash, verifiedAt: Date.now() })
    } else {
      await ctx.db.patch(id, { status: outcome })
    }
    return null
  },
})
