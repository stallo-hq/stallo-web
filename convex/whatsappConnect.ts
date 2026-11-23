import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { action, internalAction, internalMutation, internalQuery, query, type MutationCtx, type QueryCtx } from './_generated/server'
import {
  EvolutionError,
  connectInstance,
  connectionState,
  createInstance,
  evolutionConfigured,
  removeInstance,
  setWebhook,
} from './integrations/evolution'
import { toE164 } from './lib/phone'
import { textSeller } from './model/alerts'
import { raiseAttention } from './model/attention'
import { requireSeller } from './model/auth'
import { copy } from './model/copy'

/**
 * Linking a seller's WhatsApp (ADR 0002). Each seller gets one session on our
 * Evolution API server. The seller scans a QR code with WhatsApp > Linked devices;
 * Evolution then reports the session state and new QR codes to /evolution/webhook.
 *
 * Session guard: while a session is starting or showing a QR code, Stallo won't
 * restart it or ask for a new code for START_COOLDOWN_MS. Rapid relinking is one
 * of the things WhatsApp watches for.
 */

export const START_COOLDOWN_MS = 60 * 1000
/** The seller sees each QR code for about this long before Evolution sends a fresh one. */
const QR_FRESH_MS = 60 * 1000

function webhookUrl(): string {
  const site = process.env.CONVEX_SITE_URL
  if (!site) throw new EvolutionError('not_configured', 'CONVEX_SITE_URL is not available')
  return `${site.replace(/\/$/, '')}/evolution/webhook`
}

function friendly(error: unknown): ConvexError<string> {
  if (error instanceof ConvexError) return error as ConvexError<string>
  if (error instanceof EvolutionError) {
    if (error.kind === 'not_configured') return new ConvexError('WhatsApp linking isn’t set up on Stallo yet. Please try again later.')
    if (error.kind === 'temporary') return new ConvexError('Stallo’s WhatsApp server isn’t responding. Please try again in a minute.')
    return new ConvexError(`WhatsApp said: ${error.message}`)
  }
  return new ConvexError('Something went wrong linking WhatsApp. Please try again.')
}

function newInstanceName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `stallo-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

async function sessionFor(ctx: { db: QueryCtx['db'] }, seller: Pick<Doc<'sellers'>, '_id'>) {
  return await ctx.db
    .query('whatsappSessions')
    .withIndex('by_seller', (q) => q.eq('sellerId', seller._id))
    .unique()
}

async function sessionByInstance(ctx: MutationCtx, instance: string) {
  const session = await ctx.db
    .query('whatsappSessions')
    .withIndex('by_instance', (q) => q.eq('instance', instance))
    .unique()
  const seller = session ? await ctx.db.get(session.sellerId) : null
  return session && seller && seller.whatsappInstance === instance ? { session, seller } : null
}

/** Seller: what the WhatsApp settings page shows. Updates live as the phone scans the code. */
export const status = query({
  args: {},
  returns: v.object({
    available: v.boolean(),
    state: v.union(v.literal('none'), v.literal('connecting'), v.literal('open'), v.literal('close')),
    qr: v.union(v.string(), v.null()),
    phone: v.union(v.string(), v.null()),
    error: v.union(v.string(), v.null()),
    canStartAt: v.number(),
  }),
  handler: async (ctx) => {
    const seller = await requireSeller(ctx)
    const session = await sessionFor(ctx, seller)
    const now = Date.now()
    const qrFresh = session?.qr && session.qrUpdatedAt !== undefined && now - session.qrUpdatedAt < QR_FRESH_MS * 2
    return {
      available: evolutionConfigured(),
      state: seller.whatsappConnectedAt !== undefined ? ('open' as const) : (session?.state ?? ('none' as const)),
      qr: session?.state === 'connecting' && qrFresh ? session.qr! : null,
      phone: seller.whatsappDisplayPhone ?? null,
      error: session?.error ?? null,
      canStartAt: session?.state === 'connecting' ? session.startedAt + START_COOLDOWN_MS : 0,
    }
  },
})

/** Claims a (re)start for the caller's session. Atomic, so two clicks can't start twice. */
export const beginStart = internalMutation({
  args: { instance: v.string() },
  returns: v.object({ instance: v.string(), isNew: v.boolean() }),
  handler: async (ctx, { instance: proposed }) => {
    const seller = await requireSeller(ctx)
    if (seller.whatsappConnectedAt !== undefined) throw new ConvexError('WhatsApp is already linked.')
    const session = await sessionFor(ctx, seller)
    const now = Date.now()
    if (session?.state === 'connecting' && now - session.startedAt < START_COOLDOWN_MS) {
      throw new ConvexError('A code is already on its way. Scan it, or wait a minute before asking for a new one.')
    }
    const instance = seller.whatsappInstance ?? proposed
    const isNew = seller.whatsappInstance === undefined
    if (isNew) await ctx.db.patch(seller._id, { whatsappInstance: instance })
    const fields = { state: 'connecting' as const, startedAt: now, qr: undefined, qrUpdatedAt: undefined, error: undefined }
    if (session) await ctx.db.patch(session._id, { instance, ...fields })
    else await ctx.db.insert('whatsappSessions', { sellerId: seller._id, instance, ...fields })
    return { instance, isNew }
  },
})

export const failStart = internalMutation({
  args: { instance: v.string(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { instance, error }) => {
    const found = await sessionByInstance(ctx, instance)
    if (found && found.session.state === 'connecting') {
      await ctx.db.patch(found.session._id, { state: 'close', error: error.slice(0, 300), qr: undefined })
    }
    return null
  },
})

/** Seller: show a QR code to link WhatsApp. New codes then arrive through the webhook. */
export const start = action({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    if (!evolutionConfigured()) throw new ConvexError('WhatsApp linking isn’t set up on Stallo yet. Please try again later.')
    const { instance, isNew } = await ctx.runMutation(internal.whatsappConnect.beginStart, { instance: newInstanceName() })
    try {
      const url = webhookUrl()
      let qr: string | null = null
      let created = false
      if (isNew) {
        try {
          qr = await createInstance(instance, url)
          created = true
        } catch (error) {
          // Already exists on the server (e.g. a retry after a timeout): connect to it instead.
          if (!(error instanceof EvolutionError && error.kind === 'rejected')) throw error
        }
      }
      if (!created) {
        try {
          await setWebhook(instance, url)
        } catch (error) {
          // Gone from the server (e.g. its database was reset): make it again.
          if (!(error instanceof EvolutionError && error.kind === 'not_found')) throw error
          qr = await createInstance(instance, url)
          created = true
        }
      }
      if (!created) {
        if ((await connectionState(instance)) === 'open') {
          await ctx.runMutation(internal.whatsappConnect.onConnection, { instance, state: 'open' })
          return null
        }
        qr = await connectInstance(instance)
      }
      if (qr) await ctx.runMutation(internal.whatsappConnect.onQr, { instance, qr })
      return null
    } catch (error) {
      const message = friendly(error)
      await ctx.runMutation(internal.whatsappConnect.failStart, { instance, error: String(message.data) })
      throw message
    }
  },
})

/** Webhook: a new QR code for a session that's waiting to be scanned. */
export const onQr = internalMutation({
  args: { instance: v.string(), qr: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { instance, qr }) => {
    const found = await sessionByInstance(ctx, instance)
    if (!found || found.seller.whatsappConnectedAt !== undefined) return null
    if (qr === null) {
      await ctx.db.patch(found.session._id, { state: 'close', qr: undefined, error: 'The code expired before it was scanned. Ask for a new one.' })
      return null
    }
    await ctx.db.patch(found.session._id, { state: 'connecting', qr, qrUpdatedAt: Date.now(), error: undefined })
    return null
  },
})

/** Webhook (and `start`): the session's state changed. */
export const onConnection = internalMutation({
  args: {
    instance: v.string(),
    state: v.union(v.literal('open'), v.literal('connecting'), v.literal('close'), v.literal('refused')),
    phone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { instance, state, phone }) => {
    const found = await sessionByInstance(ctx, instance)
    if (!found) return null
    const { session, seller } = found

    if (state === 'open') {
      const e164 = phone ? toE164(phone) : seller.whatsappDisplayPhone
      if (e164) {
        const other = await ctx.db
          .query('sellers')
          .withIndex('by_whatsapp_display_phone', (q) => q.eq('whatsappDisplayPhone', e164))
          .take(5)
        if (other.some((s) => s._id !== seller._id && s.whatsappConnectedAt !== undefined)) {
          await ctx.db.patch(session._id, { state: 'close', qr: undefined, error: 'This WhatsApp number is already linked to another business on Stallo.' })
          await ctx.scheduler.runAfter(0, internal.whatsappConnect.unlink, { instance })
          return null
        }
      }
      await ctx.db.patch(session._id, { state: 'open', qr: undefined, error: undefined })
      if (seller.whatsappConnectedAt === undefined) {
        await ctx.db.patch(seller._id, {
          whatsappDisplayPhone: e164,
          whatsappConnectedAt: Date.now(),
          onboarding: seller.paystackSubaccountCode ? 'done' : 'payouts',
        })
      }
      return null
    }

    if (state === 'connecting') {
      if (seller.whatsappConnectedAt === undefined && session.state !== 'connecting') {
        await ctx.db.patch(session._id, { state: 'connecting' })
      }
      return null
    }

    // close or refused (too many unscanned codes)
    await ctx.db.patch(session._id, {
      state: 'close',
      qr: undefined,
      ...(state === 'refused' ? { error: 'The code expired before it was scanned. Ask for a new one.' } : {}),
    })
    if (seller.whatsappConnectedAt !== undefined) {
      await ctx.db.patch(seller._id, { whatsappConnectedAt: undefined })
      await raiseAttention(ctx, {
        sellerId: seller._id,
        type: 'whatsapp_disconnected',
        summary: 'WhatsApp was unlinked, so Stallo can’t read or reply to messages. Link it again under Settings > WhatsApp.',
      })
      await textSeller(ctx, seller, copy.sellerWhatsAppDisconnected(seller.businessName))
    }
    return null
  },
})

/** Removes a session from the Evolution server (logout, then delete). */
export const unlink = internalAction({
  args: { instance: v.string() },
  returns: v.null(),
  handler: async (_ctx, { instance }) => {
    try {
      await removeInstance(instance)
    } catch (error) {
      console.error('Could not remove WhatsApp session', instance, error instanceof Error ? error.message : error)
    }
    return null
  },
})

export const allInstances = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const sessions = await ctx.db.query('whatsappSessions').take(5000)
    return sessions.map((s) => s.instance)
  },
})

/**
 * Stallo team: re-registers every session's webhook, e.g. after changing
 * EVOLUTION_WEBHOOK_SECRET or the Convex site URL.
 * Run: npx convex run whatsappConnect:refreshWebhooks
 */
export const refreshWebhooks = internalAction({
  args: {},
  returns: v.object({ updated: v.number(), failed: v.array(v.string()) }),
  handler: async (ctx): Promise<{ updated: number; failed: string[] }> => {
    const url = webhookUrl()
    const failed: string[] = []
    let updated = 0
    for (const instance of await ctx.runQuery(internal.whatsappConnect.allInstances, {})) {
      try {
        await setWebhook(instance, url)
        updated++
      } catch (error) {
        failed.push(`${instance}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return { updated, failed }
  },
})

export const callerInstance = internalQuery({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => (await requireSeller(ctx)).whatsappInstance ?? null,
})

export const clear = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const seller = await requireSeller(ctx)
    await ctx.db.patch(seller._id, { whatsappInstance: undefined, whatsappDisplayPhone: undefined, whatsappConnectedAt: undefined })
    const session = await sessionFor(ctx, seller)
    if (session) await ctx.db.delete(session._id)
    return null
  },
})

/** Seller: unlink WhatsApp. Stallo stops reading and replying; orders are kept. */
export const disconnect = action({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const instance = await ctx.runQuery(internal.whatsappConnect.callerInstance, {})
    if (instance !== null) {
      try {
        await removeInstance(instance)
      } catch (error) {
        throw friendly(error)
      }
    }
    await ctx.runMutation(internal.whatsappConnect.clear, {})
    return null
  },
})
