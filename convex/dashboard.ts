import { v } from 'convex/values'
import { query } from './_generated/server'
import { attentionType } from './lib/validators'
import { currentSeller } from './model/auth'
import { startOfTodayAccra } from './model/time'

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
    }),
  ),
  attentionCount: v.number(),
})

/** Everything the Today page needs, in one subscription. Null when not set up. */
export const today = query({
  args: {},
  returns: v.union(todayView, v.null()),
  handler: async (ctx) => {
    const seller = await currentSeller(ctx)
    if (seller === null) return null

    const since = startOfTodayAccra()
    const [anyProduct, todaysOrders, awaitingPayment, toDeliver, openAttention] =
      await Promise.all([
        ctx.db
          .query('products')
          .withIndex('by_seller', (q) => q.eq('sellerId', seller._id))
          .first(),
        ctx.db
          .query('orders')
          .withIndex('by_seller_and_created', (q) =>
            q.eq('sellerId', seller._id).gte('createdAt', since),
          )
          .take(1000),
        ctx.db
          .query('orders')
          .withIndex('by_seller_and_status', (q) =>
            q.eq('sellerId', seller._id).eq('status', 'awaiting_payment'),
          )
          .take(1000),
        ctx.db
          .query('orders')
          .withIndex('by_seller_and_status', (q) =>
            q.eq('sellerId', seller._id).eq('status', 'paid'),
          )
          .take(1000),
        ctx.db
          .query('attentionItems')
          .withIndex('by_seller_and_resolved', (q) =>
            q.eq('sellerId', seller._id).eq('resolved', false),
          )
          .order('desc')
          .take(100),
      ])

    const placedToday = todaysOrders.filter((o) => o.status !== 'draft')
    const paidTodayPesewas = placedToday
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + o.subtotalPesewas, 0)

    return {
      setup: {
        hasProducts: anyProduct !== null,
        whatsappConnected: seller.whatsappPhoneNumberId !== undefined,
        payoutsConnected: seller.paystackSubaccountCode !== undefined,
      },
      stats: {
        ordersToday: placedToday.length,
        paidTodayPesewas,
        awaitingPayment: awaitingPayment.length,
        toDeliver: toDeliver.length,
      },
      attention: openAttention
        .slice(0, 5)
        .map(({ _id, type, summary, createdAt }) => ({ _id, type, summary, createdAt })),
      attentionCount: openAttention.length,
    }
  },
})
