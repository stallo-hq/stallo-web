import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { formatCedis } from './lib/money'
import { textSeller } from './model/alerts'
import { copy } from './model/copy'
import { todayStats } from './model/stats'

/**
 * Cron, every evening: an SMS summary of the day to each seller with WhatsApp
 * linked (ADR 0002: Stallo has no WhatsApp number of its own). Works through
 * sellers in pages so it scales.
 */
export const sendDaily = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('sellers').paginate({ cursor: cursor ?? null, numItems: 50 })
    for (const seller of page.page) {
      if (!seller.whatsappConnectedAt) continue
      const stats = await todayStats(ctx, seller)
      await textSeller(
        ctx,
        seller,
        copy.sellerDailySummary(seller.businessName, {
          orders: stats.ordersToday,
          paid: formatCedis(stats.paidTodayPesewas),
          toDeliver: stats.toDeliver,
          attention: stats.openAttention.length,
        }),
      )
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.summary.sendDaily, { cursor: page.continueCursor })
    return null
  },
})
