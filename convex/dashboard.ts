import { v } from 'convex/values'
import { query } from './_generated/server'
import { attentionType } from './lib/validators'
import { currentSeller } from './model/auth'
import { todayStats } from './model/stats'

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
        whatsappConnected: seller.whatsappPhoneNumberId !== undefined,
        payoutsConnected: seller.paystackSubaccountCode !== undefined,
      },
      stats: {
        ordersToday: stats.ordersToday,
        paidTodayPesewas: stats.paidTodayPesewas,
        awaitingPayment: stats.awaitingPayment,
        toDeliver: stats.toDeliver,
      },
      attention: stats.openAttention
        .slice(0, 8)
        .map(({ _id, type, summary, createdAt, orderId }) => ({ _id, type, summary, createdAt, orderId })),
      attentionCount: stats.openAttention.length,
    }
  },
})
