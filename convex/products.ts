import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx } from './_generated/server'
import { assertOwned, currentSeller, requireSeller } from './model/auth'
import { checkWholeNumber, cleanText, LIMITS } from './model/validation'

const productInput = {
  name: v.string(),
  pricePesewas: v.number(),
  stock: v.number(),
  active: v.boolean(),
  /** Leave out to keep the current photo, null to remove it, or a new upload. */
  photoId: v.optional(v.union(v.id('_storage'), v.null())),
}

const productView = v.object({
  _id: v.id('products'),
  _creationTime: v.number(),
  name: v.string(),
  pricePesewas: v.number(),
  stock: v.number(),
  active: v.boolean(),
  photoUrl: v.union(v.string(), v.null()),
})

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

function clean(args: { name: string; pricePesewas: number; stock: number; active: boolean }) {
  return {
    name: cleanText(args.name, 'Name', LIMITS.productName),
    pricePesewas: checkWholeNumber(args.pricePesewas, 'Price', LIMITS.pricePesewas),
    stock: checkWholeNumber(args.stock, 'Stock', LIMITS.stock),
    active: args.active,
  }
}

/** Checks a fresh upload is an image of a sensible size. */
async function checkPhoto(ctx: MutationCtx, photoId: Id<'_storage'>) {
  const file = await ctx.db.system.get(photoId)
  if (!file) throw new ConvexError('The photo didn’t upload. Try again.')
  if (!file.contentType?.startsWith('image/')) throw new ConvexError('Choose a photo (JPG or PNG).')
  if (file.size > MAX_PHOTO_BYTES) throw new ConvexError('That photo is too large. Choose one under 5 MB.')
}

/** The seller's products, alphabetical. Empty when signed out. */
export const list = query({
  args: {},
  returns: v.array(productView),
  handler: async (ctx) => {
    const seller = await currentSeller(ctx)
    if (seller === null) return []
    const products = await ctx.db
      .query('products')
      .withIndex('by_seller', (q) => q.eq('sellerId', seller._id))
      .take(500)
    const views = await Promise.all(
      products.map(async ({ _id, _creationTime, name, pricePesewas, stock, active, photoId }) => ({
        _id,
        _creationTime,
        name,
        pricePesewas,
        stock,
        active,
        photoUrl: photoId ? await ctx.storage.getUrl(photoId) : null,
      })),
    )
    return views.sort((a, b) => a.name.localeCompare(b.name))
  },
})

/** A one-time URL the dashboard uploads a product photo to. */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireSeller(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const create = mutation({
  args: productInput,
  returns: v.id('products'),
  handler: async (ctx, { photoId, ...args }) => {
    const seller = await requireSeller(ctx)
    if (photoId) await checkPhoto(ctx, photoId)
    const productId = await ctx.db.insert('products', { sellerId: seller._id, ...clean(args), photoId: photoId ?? undefined })
    if (photoId) await ctx.scheduler.runAfter(0, internal.vision.describeProduct, { productId })
    await ctx.scheduler.runAfter(0, internal.matching.embedProduct, { productId })
    return productId
  },
})

export const update = mutation({
  args: { productId: v.id('products'), ...productInput },
  returns: v.null(),
  handler: async (ctx, { productId, photoId, ...args }) => {
    const seller = await requireSeller(ctx)
    const product = assertOwned(await ctx.db.get(productId), seller, 'Product')
    const photoChanged = photoId !== undefined && photoId !== (product.photoId ?? null)
    if (photoChanged && photoId) await checkPhoto(ctx, photoId)
    await ctx.db.patch(productId, {
      ...clean(args),
      ...(photoChanged ? { photoId: photoId ?? undefined, photoDescription: undefined } : {}),
    })
    if (photoChanged && product.photoId) await ctx.storage.delete(product.photoId)
    if (photoChanged && photoId) await ctx.scheduler.runAfter(0, internal.vision.describeProduct, { productId })
    // Does nothing if the name (and photo description) didn't change.
    await ctx.scheduler.runAfter(0, internal.matching.embedProduct, { productId })
    return null
  },
})

/** Orders keep their own copy of name and price, so deleting a product never changes past orders. */
export const remove = mutation({
  args: { productId: v.id('products') },
  returns: v.null(),
  handler: async (ctx, { productId }) => {
    const seller = await requireSeller(ctx)
    const product = assertOwned(await ctx.db.get(productId), seller, 'Product')
    if (product.photoId) await ctx.storage.delete(product.photoId)
    const embedding = await ctx.db
      .query('productEmbeddings')
      .withIndex('by_product', (q) => q.eq('productId', productId))
      .unique()
    if (embedding) await ctx.db.delete(embedding._id)
    await ctx.db.delete(productId)
    return null
  },
})
