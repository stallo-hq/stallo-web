import { v } from 'convex/values'
import { query } from './_generated/server'
import { orderStatus, paymentStatus } from './lib/validators'
import { currentSeller } from './model/auth'
import { ACTIVE_STATUSES } from './model/orders'

const orderRow = v.object({
  _id: v.id('orders'),
  createdAt: v.number(),
  customerPhone: v.string(),
  customerName: v.optional(v.string()),
  itemsSummary: v.string(),
  totalPesewas: v.number(),
  status: orderStatus,
  paymentStatus: paymentStatus,
})

/** Newest first. `active` = everything still in progress; drafts are never listed. */
export const list = query({
  args: { filter: v.union(v.literal('active'), v.literal('delivered'), v.literal('all')) },
  returns: v.array(orderRow),
  handler: async (ctx, { filter }) => {
    const seller = await currentSeller(ctx)
    if (seller === null) return []

    const orders = await ctx.db
      .query('orders')
      .withIndex('by_seller_and_created', (q) => q.eq('sellerId', seller._id))
      .order('desc')
      .take(200)

    const visible = orders.filter((o) => {
      if (o.status === 'draft') return false
      if (filter === 'active') return ACTIVE_STATUSES.has(o.status)
      if (filter === 'delivered') return o.status === 'delivered'
      return true
    })

    return await Promise.all(
      visible.map(async (o) => {
        const customer = await ctx.db.get(o.customerId)
        return {
          _id: o._id,
          createdAt: o.createdAt,
          customerPhone: customer?.phone ?? '',
          customerName: customer?.name,
          itemsSummary: o.items.map((i) => `${i.qty} × ${i.name}`).join(', '),
          totalPesewas: o.totalPesewas,
          status: o.status,
          paymentStatus: o.paymentStatus,
        }
      }),
    )
  },
})
