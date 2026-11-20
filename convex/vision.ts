import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { describeProductPhoto, visionConfigured } from './integrations/vision'

/**
 * After a seller adds a product photo, the AI writes a short description of it
 * once. Customers' pictures are then matched against those descriptions, so each
 * customer picture needs only one AI call however many products there are.
 */
export const describeProduct = internalAction({
  args: { productId: v.id('products') },
  returns: v.null(),
  handler: async (ctx, { productId }): Promise<null> => {
    if (!visionConfigured()) return null
    const product: { name: string; photoId: Id<'_storage'> } | null = await ctx.runQuery(internal.vision.productPhoto, { productId })
    if (product === null) return null
    const blob = await ctx.storage.get(product.photoId)
    if (!blob) return null
    try {
      const description = await describeProductPhoto(
        { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type || 'image/jpeg' },
        product.name,
      )
      await ctx.runMutation(internal.vision.saveDescription, { productId, photoId: product.photoId, description })
    } catch {
      // Without a description the product is still matched by its name.
    }
    return null
  },
})

export const productPhoto = internalQuery({
  args: { productId: v.id('products') },
  returns: v.union(v.null(), v.object({ name: v.string(), photoId: v.id('_storage') })),
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId)
    return product?.photoId ? { name: product.name, photoId: product.photoId } : null
  },
})

export const saveDescription = internalMutation({
  args: { productId: v.id('products'), photoId: v.id('_storage'), description: v.string() },
  returns: v.null(),
  handler: async (ctx, { productId, photoId, description }) => {
    const product = await ctx.db.get(productId)
    // Only if the photo hasn't been changed again in the meantime.
    if (product?.photoId === photoId) await ctx.db.patch(productId, { photoDescription: description })
    return null
  },
})
