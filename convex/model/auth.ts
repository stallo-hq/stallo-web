import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

/**
 * The single place that decides "who is calling and which seller do they own".
 * Every seller-facing function goes through these helpers, so ownership checks
 * can't be forgotten or done differently in different files.
 */

export async function requireUserId(ctx: QueryCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) throw new ConvexError('Not signed in')
  return userId
}

export async function findSellerForUser(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<Doc<'sellers'> | null> {
  return await ctx.db
    .query('sellers')
    .withIndex('by_owner', (q) => q.eq('ownerId', userId))
    .unique()
}

/** The caller's seller profile, or null when signed out or not set up yet. Use in queries. */
export async function currentSeller(ctx: QueryCtx): Promise<Doc<'sellers'> | null> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) return null
  return await findSellerForUser(ctx, userId)
}

/** The caller's seller profile; throws if signed out or not set up. Use in mutations. */
export async function requireSeller(ctx: QueryCtx): Promise<Doc<'sellers'>> {
  const userId = await requireUserId(ctx)
  const seller = await findSellerForUser(ctx, userId)
  if (seller === null) throw new ConvexError('Set up your business first')
  return seller
}

/** Throws unless the document belongs to the seller. Returns it narrowed to non-null. */
export function assertOwned<T extends { sellerId: Id<'sellers'> }>(
  doc: T | null,
  seller: Doc<'sellers'>,
  what: string,
): T {
  if (doc === null || doc.sellerId !== seller._id) throw new ConvexError(`${what} not found`)
  return doc
}
