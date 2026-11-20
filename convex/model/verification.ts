import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import { sha256 } from './crypto'

export { randomToken, sha256 } from './crypto'

/** How long a verified-phone token stays usable. */
export const TOKEN_TTL_MS = 30 * 60 * 1000
/** Codes per phone number per hour, and across the whole service per hour. */
export const SENDS_PER_PHONE_PER_HOUR = 5
export const DEFAULT_SENDS_PER_HOUR = 300

/**
 * Spends a verified-phone token: it must exist, be for this phone, be fresh
 * and unused. Throws otherwise. One use only.
 */
export async function consumePhoneToken(ctx: MutationCtx, token: string, phone: string): Promise<void> {
  const tokenHash = await sha256(token)
  const row = await ctx.db
    .query('phoneVerifications')
    .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
    .unique()
  const fresh = row?.verifiedAt !== undefined && Date.now() - row.verifiedAt < TOKEN_TTL_MS
  if (row === null || row.status !== 'verified' || row.phone !== phone || !fresh) {
    throw new ConvexError({ code: 'VERIFICATION_EXPIRED', message: 'Your phone check has expired. Get a new code and try again.' })
  }
  await ctx.db.patch(row._id, { status: 'used' })
}
