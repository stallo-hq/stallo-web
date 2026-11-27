import { v } from 'convex/values'
import { query } from './_generated/server'
import { attentionType } from './lib/validators'
import { currentSeller } from './model/auth'
import { todayStats } from './model/stats'
import { TRACKER_QUERY_LIMIT, buildTrackerAnalytics, trackerWindowBounds } from './model/tracker'

const todayView = v.object({
  setup: v.object({
    hasProducts: v.boolean(),
    whatsappConnected: v.boolean(),
    payoutsConnected: v.boolean(),
  }),
  stats: v.object({
    ordersToday: v.number(),
    paidTodayPesewas: v.number(),
    awaitingPayment: v.number(),
    toDeliver: v.number(),
  }),
  attention: v.array(
    v.object({
      _id: v.id('attentionItems'),
      type: attentionType,
      summary: v.string(),
      createdAt: v.number(),
      orderId: v.optional(v.id('orders')),
      /** The picture the customer sent, when there is one. */
      imageUrl: v.union(v.string(), v.null()),
    }),
  ),
  attentionCount: v.number(),
})

/** Everything the Overview page needs, in one subscription. Null when not set up. */
export const today = query({
  args: {},
  returns: v.union(todayView, v.null()),
  handler: async (ctx) => {
    const seller = await currentSeller(ctx)
    if (seller === null) return null

    const [anyProduct, stats] = await Promise.all([
      ctx.db
        .query('products')
        .withIndex('by_seller', (q) => q.eq('sellerId', seller._id))
        .first(),
      todayStats(ctx, seller),
    ])

    return {
      setup: {
        hasProducts: anyProduct !== null,
        whatsappConnected: seller.whatsappConnectedAt !== undefined,
        payoutsConnected: seller.paystackSubaccountCode !== undefined,
      },
      stats: {
        ordersToday: stats.ordersToday,
        paidTodayPesewas: stats.paidTodayPesewas,
        awaitingPayment: stats.awaitingPayment,
        toDeliver: stats.toDeliver,
      },
      attention: await Promise.all(
        stats.openAttention.slice(0, 8).map(async ({ _id, type, summary, createdAt, orderId, inboundMessageId }) => {
          const message = inboundMessageId ? await ctx.db.get(inboundMessageId) : null
          const imageUrl = message?.mediaId ? await ctx.storage.getUrl(message.mediaId) : null
          return { _id, type, summary, createdAt, orderId, imageUrl }
        }),
      ),
      attentionCount: stats.openAttention.length,
    }
  },
})

const stageStat = v.object({ count: v.number(), pesewas: v.number() })

const trackerView = v.object({
  range: v.union(v.literal('7d'), v.literal('30d'), v.literal('90d')),
  days: v.number(),
  series: v.array(
    v.object({
      date: v.number(),
      orders: v.number(),
      paidOrders: v.number(),
      deliveredOrders: v.number(),
      revenuePesewas: v.number(),
      grossPesewas: v.number(),
      prevOrders: v.number(),
      prevDeliveredOrders: v.number(),
      prevRevenuePesewas: v.number(),
    }),
  ),
  totals: v.object({
    orders: v.number(),
    paidOrders: v.number(),
    deliveredOrders: v.number(),
    failedOrCancelled: v.number(),
    revenuePesewas: v.number(),
    grossPesewas: v.number(),
    avgOrderPesewas: v.number(),
    paymentRatePct: v.number(),
    fulfilmentRatePct: v.number(),
  }),
  previousTotals: v.object({
    orders: v.number(),
    paidOrders: v.number(),
    deliveredOrders: v.number(),
    revenuePesewas: v.number(),
    grossPesewas: v.number(),
    avgOrderPesewas: v.number(),
  }),
  deltas: v.object({
    revenuePct: v.union(v.number(), v.null()),
    ordersPct: v.union(v.number(), v.null()),
    deliveredPct: v.union(v.number(), v.null()),
    avgOrderPct: v.union(v.number(), v.null()),
  }),
  pipeline: v.object({
    awaitingPayment: stageStat,
    readyToDispatch: stageStat,
    inTransit: stageStat,
    delivered: stageStat,
    issues: stageStat,
  }),
  paymentMix: v.object({
    onlineOrders: v.number(),
    onlinePesewas: v.number(),
    cashOrders: v.number(),
    cashPesewas: v.number(),
  }),
  topProducts: v.array(
    v.object({
      name: v.string(),
      unitsSold: v.number(),
      revenuePesewas: v.number(),
    }),
  ),
  partial: v.boolean(),
})

/** Real-time shop performance tracker across 7d, 30d, or 90d with prior-period comparison. */
export const tracker = query({
  args: { range: v.union(v.literal('7d'), v.literal('30d'), v.literal('90d')) },
  returns: v.union(trackerView, v.null()),
  handler: async (ctx, { range }) => {
    const seller = await currentSeller(ctx)
    if (seller === null) return null

    const now = Date.now()
    const { previousFrom } = trackerWindowBounds(range, now)
    const orders = await ctx.db
      .query('orders')
      .withIndex('by_seller_and_created', (q) => q.eq('sellerId', seller._id).gte('createdAt', previousFrom))
      .order('desc')
      .take(TRACKER_QUERY_LIMIT)

    return buildTrackerAnalytics(orders, range, now, orders.length >= TRACKER_QUERY_LIMIT)
  },
})
