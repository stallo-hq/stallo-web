import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { startOfTodayAccra } from './time'

/** Today's numbers for one seller. Used by the dashboard and the daily WhatsApp summary. */
export async function todayStats(ctx: QueryCtx, seller: Doc<'sellers'>) {
  const since = startOfTodayAccra()
  const [todaysOrders, awaitingPayment, toDeliver, openAttention] = await Promise.all([
    ctx.db
      .query('orders')
      .withIndex('by_seller_and_created', (q) => q.eq('sellerId', seller._id).gte('createdAt', since))
      .take(1000),
    ctx.db
      .query('orders')
      .withIndex('by_seller_and_status', (q) => q.eq('sellerId', seller._id).eq('status', 'awaiting_payment'))
      .take(1000),
    ctx.db
      .query('orders')
      .withIndex('by_seller_and_status', (q) => q.eq('sellerId', seller._id).eq('status', 'paid'))
      .take(1000),
    ctx.db
      .query('attentionItems')
      .withIndex('by_seller_and_resolved', (q) => q.eq('sellerId', seller._id).eq('resolved', false))
      .order('desc')
      .take(100),
  ])
  const placedToday = todaysOrders.filter((o) => o.status !== 'draft' && o.status !== 'awaiting_confirmation')
  return {
    ordersToday: placedToday.length,
    paidTodayPesewas: placedToday
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + o.subtotalPesewas, 0),
    awaitingPayment: awaitingPayment.length,
    toDeliver: toDeliver.length,
    openAttention,
  }
}
