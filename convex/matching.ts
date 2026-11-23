import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery, type ActionCtx } from './_generated/server'
import { EMBEDDING_DIMENSIONS, HuggingFaceError, embed, embeddingModel, huggingfaceConfigured } from './integrations/huggingface'
import { productText } from './model/matching'

/**
 * Product embeddings (Hugging Face) kept in Convex's vector index. A product is
 * embedded when it's added, renamed or its photo is described. Matching is an
 * extra: if Hugging Face is off or fails, the assistant simply sees the whole
 * catalogue as before.
 */

export const productForEmbedding = internalQuery({
  args: { productId: v.id('products') },
  returns: v.union(v.null(), v.object({ sellerId: v.id('sellers'), text: v.string(), current: v.boolean() })),
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId)
    if (!product) return null
    const text = productText(product)
    const existing = await ctx.db
      .query('productEmbeddings')
      .withIndex('by_product', (q) => q.eq('productId', productId))
      .unique()
    return { sellerId: product.sellerId, text, current: existing?.text === text && existing.model === embeddingModel() }
  },
})

export const saveEmbedding = internalMutation({
  args: { productId: v.id('products'), text: v.string(), model: v.string(), embedding: v.array(v.float64()) },
  returns: v.null(),
  handler: async (ctx, { productId, text, model, embedding }) => {
    const product = await ctx.db.get(productId)
    // Skip if the product was deleted or changed again while we waited.
    if (!product || productText(product) !== text || embedding.length !== EMBEDDING_DIMENSIONS) return null
    const existing = await ctx.db
      .query('productEmbeddings')
      .withIndex('by_product', (q) => q.eq('productId', productId))
      .unique()
    const row = { productId, sellerId: product.sellerId, text, model, embedding }
    if (existing) await ctx.db.replace(existing._id, row)
    else await ctx.db.insert('productEmbeddings', row)
    return null
  },
})

const RETRIES = 3

/** Embeds one product. Retries while the model is loading or rate-limited. */
export const embedProduct = internalAction({
  args: { productId: v.id('products'), attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { productId, attempt = 0 }): Promise<null> => {
    if (!huggingfaceConfigured()) return null
    const product = await ctx.runQuery(internal.matching.productForEmbedding, { productId })
    if (product === null || product.current) return null
    try {
      const [embedding] = await embed([product.text])
      await ctx.runMutation(internal.matching.saveEmbedding, { productId, text: product.text, model: embeddingModel(), embedding })
    } catch (error) {
      const temporary = error instanceof HuggingFaceError && error.kind === 'temporary'
      if (temporary && attempt < RETRIES) {
        await ctx.scheduler.runAfter(20_000 * 2 ** attempt, internal.matching.embedProduct, { productId, attempt: attempt + 1 })
      } else {
        console.error('Embedding the product failed:', error instanceof Error ? error.message : error)
      }
    }
    return null
  },
})

export const productIdsPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ ids: v.array(v.id('products')), cursor: v.string(), done: v.boolean() }),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('products').paginate({ cursor, numItems: 50 })
    return { ids: page.page.map((p) => p._id), cursor: page.continueCursor, done: page.isDone }
  },
})

/**
 * Stallo team: embeds every product that has no current embedding (first setup,
 * or after changing HUGGINGFACE_EMBED_MODEL). Spread out to stay within rate limits.
 * Run: npx convex run matching:backfill
 */
export const backfill = internalAction({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.number(),
  handler: async (ctx, { cursor }): Promise<number> => {
    if (!huggingfaceConfigured()) throw new Error('Set HUGGINGFACE_API_KEY first')
    const page: { ids: Id<'products'>[]; cursor: string; done: boolean } = await ctx.runQuery(internal.matching.productIdsPage, { cursor: cursor ?? null })
    for (const [i, productId] of page.ids.entries()) {
      await ctx.scheduler.runAfter(i * 500, internal.matching.embedProduct, { productId })
    }
    if (!page.done) await ctx.scheduler.runAfter(page.ids.length * 500, internal.matching.backfill, { cursor: page.cursor })
    return page.ids.length
  },
})

/**
 * The seller's products ranked by closeness in meaning to `message`, best first.
 * Null when matching is off or anything fails; callers then use the whole catalogue.
 */
export async function rankProducts(ctx: ActionCtx, sellerId: Id<'sellers'>, message: string, limit: number): Promise<string[] | null> {
  if (!huggingfaceConfigured() || message.trim() === '') return null
  try {
    const [vector] = await embed([message])
    const results = await ctx.vectorSearch('productEmbeddings', 'by_embedding', {
      vector,
      limit: Math.min(256, Math.max(1, limit)),
      filter: (q) => q.eq('sellerId', sellerId),
    })
    if (results.length === 0) return null
    const rows: { productId: Id<'products'> }[] = await ctx.runQuery(internal.matching.rowsByIds, { ids: results.map((r) => r._id) })
    return rows.map((r) => r.productId)
  } catch (error) {
    console.warn('Product matching skipped:', error instanceof Error ? error.message : error)
    return null
  }
}

export const rowsByIds = internalQuery({
  args: { ids: v.array(v.id('productEmbeddings')) },
  returns: v.array(v.object({ productId: v.id('products') })),
  handler: async (ctx, { ids }) => {
    const rows = []
    for (const id of ids) {
      const row = await ctx.db.get(id)
      if (row) rows.push({ productId: row.productId })
    }
    return rows
  },
})

/**
 * Stallo team: checks Hugging Face end to end. Embeds two phrases that mean the
 * same thing and one that doesn't, and reports the similarities. Nothing is stored.
 * Run: npx convex run matching:check
 */
export const check = internalAction({
  args: {},
  returns: v.object({ ok: v.boolean(), model: v.string(), dimensions: v.number(), similar: v.number(), different: v.number(), error: v.optional(v.string()) }),
  handler: async () => {
    const model = embeddingModel()
    try {
      const [a, b, c] = await embed(['jollof rice with chicken', 'abeg give me jollof and chicken', 'mobile phone charger'])
      const dot = (x: number[], y: number[]) => x.reduce((sum, xi, i) => sum + xi * y[i], 0)
      const similar = dot(a, b)
      const different = dot(a, c)
      return { ok: similar > different, model, dimensions: a.length, similar, different }
    } catch (error) {
      return { ok: false, model, dimensions: 0, similar: 0, different: 0, error: error instanceof Error ? error.message : String(error) }
    }
  },
})
