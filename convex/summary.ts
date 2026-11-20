import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { formatCedis } from './lib/money'
import { queueMessage } from './model/outbound'
import { todayStats } from './model/stats'

/**
 * Cron, every evening: a WhatsApp summary of the day to each seller with a
 * connected number. Sent from Stallo's own number as an approved template, so
 * it needs WHATSAPP_PLATFORM_PHONE_NUMBER_ID; without it nothing is sent.
 * Works through sellers in pages so it scales.
 */
export const sendDaily = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    if (!process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID) return null
    const page = await ctx.db.query('sellers').paginate({ cursor: cursor ?? null, numItems: 50 })
    for (const seller of page.page) {
      if (!seller.whatsappPhoneNumberId) continue
      const stats = await todayStats(ctx, seller)
      await queueMessage(ctx, {
        sellerId: seller._id,
        to: seller.phone,
        template: {
          name: 'stallo_seller_daily_summary',
          params: [
            seller.businessName,
            String(stats.ordersToday),
            formatCedis(stats.paidTodayPesewas),
            String(stats.toDeliver),
            String(stats.openAttention.length),
          ],
        },
      })
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.summary.sendDaily, { cursor: page.continueCursor })
    return null
  },
})
