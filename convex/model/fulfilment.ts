import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { formatCedis } from '../lib/money'
import { textSeller } from './alerts'
import { raiseAttention } from './attention'
import { copy } from './copy'
import { itemsSummary, orderLabel } from './orders'
import { queueMessage } from './outbound'

/** What the customer pays online: everything, or only the delivery fee for cash orders. */
export function onlineAmount(order: Pick<Doc<'orders'>, 'paymentMethod' | 'totalPesewas' | 'deliveryFeePesewas'>): number {
  return order.paymentMethod === 'cash' ? (order.deliveryFeePesewas ?? 0) : order.totalPesewas
}

/** Adds to (or, with a negative amount, takes from) what the seller owes Stallo. */
export async function adjustFeeBalance(ctx: MutationCtx, seller: Doc<'sellers'>, deltaPesewas: number): Promise<void> {
  if (deltaPesewas === 0) return
  const fresh = (await ctx.db.get(seller._id)) ?? seller
  await ctx.db.patch(seller._id, { feeBalancePesewas: (fresh.feeBalancePesewas ?? 0) + deltaPesewas })
}

/**
 * An order is ready to prepare (paid online, or confirmed for cash): take the
 * items out of stock and tell the customer and the seller.
 */
export async function startFulfilment(ctx: MutationCtx, order: Doc<'orders'>, seller: Doc<'sellers'>, customer: Doc<'customers'>) {
  const short: string[] = []
  for (const item of order.items) {
    const product = await ctx.db.get(item.productId)
    if (!product) continue
    if (product.stock < item.qty) short.push(product.name)
    await ctx.db.patch(product._id, { stock: Math.max(0, product.stock - item.qty) })
  }
  if (short.length > 0) {
    await raiseAttention(ctx, {
      sellerId: seller._id,
      type: 'stock_problem',
      orderId: order._id,
      summary: `Order ${orderLabel(order)} is confirmed, but stock shows too few of: ${short.join(', ')}. Check before sending it out.`,
    })
  }

  const cash = order.paymentMethod === 'cash'
  const text = cash && onlineAmount(order) === 0 ? copy.cashConfirmed(order, seller.businessName) : copy.paid(order, seller.businessName)
  await queueMessage(ctx, { sellerId: seller._id, to: customer.phone, orderId: order._id, text })
  await textSeller(
    ctx,
    seller,
    copy.sellerOrderPaid(
      order,
      itemsSummary(order.items),
      cash ? `${formatCedis(order.totalPesewas)}, ${formatCedis(order.cashDuePesewas ?? 0)} in cash to the rider` : formatCedis(order.totalPesewas),
    ),
  )
}
