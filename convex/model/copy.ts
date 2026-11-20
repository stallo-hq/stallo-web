import type { Doc } from '../_generated/dataModel'
import { formatCedis } from '../lib/money'
import { orderLabel } from './orders'

/**
 * Every message Stallo writes to customers, riders and sellers, in one place.
 * Short, plain English, no emoji (CLAUDE.md §6.3). Prices always come from the
 * order, never from the assistant.
 */

type Product = Pick<Doc<'products'>, 'name' | 'pricePesewas'>
type Order = Pick<Doc<'orders'>, '_id' | 'number' | 'items' | 'subtotalPesewas' | 'totalPesewas' | 'address'>

export function catalogue(products: Product[], limit = 12): string {
  if (products.length === 0) return ''
  const lines = products.slice(0, limit).map((p) => `- ${p.name}: ${formatCedis(p.pricePesewas)}`)
  if (products.length > limit) lines.push(`…and ${products.length - limit} more`)
  return lines.join('\n')
}

export const copy = {
  welcome(business: string, products: Product[]) {
    const list = catalogue(products)
    return list
      ? `Hello, welcome to ${business}. What would you like to order?\n\n${list}`
      : `Hello, welcome to ${business}. What would you like to order?`
  },

  askWhatToOrder(products: Product[]) {
    const list = catalogue(products)
    return list ? `What would you like to order? Here is what we have:\n\n${list}` : 'What would you like to order?'
  },

  holding(business: string) {
    return `Thanks for your message. Someone from ${business} will reply shortly.`
  },

  unsupportedMedia(business: string) {
    return `Thanks. I can only read text messages here, so someone from ${business} will look at this and reply shortly.`
  },

  orderLines(order: Order) {
    const lines = order.items.map((i) => `${i.qty} × ${i.name} — ${formatCedis(i.unitPricePesewas * i.qty)}`)
    return `${lines.join('\n')}\nTotal: ${formatCedis(order.subtotalPesewas)}`
  },

  askAddress(order: Order) {
    return `Here is your order:\n\n${copy.orderLines(order)}\n\nWhere should we deliver it? You can type the address or share your location.`
  },

  confirm(order: Order, usingSavedAddress: boolean) {
    const to = usingSavedAddress
      ? `Delivery to: ${order.address}\n(Reply with a new address to change it.)`
      : `Delivery to: ${order.address}`
    return `Please confirm your order:\n\n${copy.orderLines(order)}\n${to}\n\nReply YES to confirm, or tell me what to change.`
  },

  unavailable(names: string[]) {
    return names.length === 1
      ? `Sorry, ${names[0]} is not available right now.`
      : `Sorry, these are not available right now: ${names.join(', ')}.`
  },

  limitedStock(name: string, stock: number) {
    return `We only have ${stock} ${name} left, so I've put ${stock} in your order.`
  },

  payLink(order: Order, url: string) {
    return `Thank you. Your order ${orderLabel(order)} comes to ${formatCedis(order.totalPesewas)}.\n\nPay here with mobile money or card:\n${url}\n\nWe'll start on it as soon as payment comes through.`
  },

  payLinkDelayed(business: string) {
    return `Thank you. ${business} will send your payment link shortly.`
  },

  paid(order: Order, business: string) {
    return `Payment received for order ${orderLabel(order)}. Thank you. ${business} will let you know when it's on the way.`
  },

  cancelledByCustomer() {
    return `Okay, I've cancelled that order. Message us any time to order again.`
  },

  nothingToCancel() {
    return `No problem. Message us any time you'd like to order.`
  },

  nothingToConfirm(products: Product[]) {
    return copy.askWhatToOrder(products)
  },

  // Delivery

  deliveryPin(business: string, order: Order, riderName: string, pin: string) {
    return `Your order ${orderLabel(order)} from ${business} is on the way with ${riderName}.\n\nYour delivery code is ${pin}. Give it to the rider only when you have your order.`
  },

  delivered(business: string, order: Order) {
    return `Your order ${orderLabel(order)} from ${business} has been delivered. Thank you for buying from us.`
  },

  deliveryFailed(business: string, order: Order) {
    return `We couldn't complete delivery of order ${orderLabel(order)} today. ${business} will contact you to arrange it.`
  },

  cancelledBySeller(business: string, order: Order, refunded: boolean) {
    return refunded
      ? `${business} has cancelled order ${orderLabel(order)}. Your payment is being refunded.`
      : `${business} has cancelled order ${orderLabel(order)}.`
  },

  riderJob(business: string, order: Order, customer: string, link: string) {
    return `New delivery for ${business}: order ${orderLabel(order)}.\nCustomer: ${customer}\nAddress: ${order.address ?? 'ask the customer'}\n\nOpen this page for details and to confirm delivery:\n${link}\n\nWhen you hand over the order, ask the customer for their 4-digit code and send it here or on that page.`
  },

  riderDelivered(order: Order) {
    return `Code accepted. Order ${orderLabel(order)} is marked delivered. Thank you.`
  },

  riderWrongPin(attemptsLeft: number) {
    return attemptsLeft > 0
      ? `That code isn't right. Check it with the customer and try again (${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left).`
      : `That code isn't right and there are no tries left. The seller has been told.`
  },
}
