import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertOwned, currentSeller, requireSeller } from './model/auth'
import { checkWholeNumber, cleanText, LIMITS } from './model/validation'

const productInput = {
  name: v.string(),
  pricePesewas: v.number(),
  stock: v.number(),
  active: v.boolean(),
}

const productView = v.object({
  _id: v.id('products'),
  _creationTime: v.number(),
  name: v.string(),
  pricePesewas: v.number(),
  stock: v.number(),
  active: v.boolean(),
})

function clean(args: { name: string; pricePesewas: number; stock: number; active: boolean }) {
  return {
    name: cleanText(args.name, 'Name', LIMITS.productName),
    pricePesewas: checkWholeNumber(args.pricePesewas, 'Price', LIMITS.pricePesewas),
    stock: checkWholeNumber(args.stock, 'Stock', LIMITS.stock),
    active: args.active,
  }
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
    return products
      .map(({ _id, _creationTime, name, pricePesewas, stock, active }) => ({
        _id,
        _creationTime,
        name,
        pricePesewas,
        stock,
        active,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const create = mutation({
  args: productInput,
  returns: v.id('products'),
  handler: async (ctx, args) => {
    const seller = await requireSeller(ctx)
    return await ctx.db.insert('products', { sellerId: seller._id, ...clean(args) })
  },
})

export const update = mutation({
  args: { productId: v.id('products'), ...productInput },
  returns: v.null(),
  handler: async (ctx, { productId, ...args }) => {
    const seller = await requireSeller(ctx)
    assertOwned(await ctx.db.get(productId), seller, 'Product')
    await ctx.db.patch(productId, clean(args))
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
    await ctx.db.delete(productId)
    return null
  },
})
