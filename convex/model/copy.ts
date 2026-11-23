import type { Doc } from '../_generated/dataModel'
import { formatCedis } from '../lib/money'
import { formatGhanaPhone } from '../lib/phone'
import { orderLabel } from './orders'

/**
 * Every message Stallo writes to customers, riders and sellers, in one place.
 * Short, plain English, no emoji (CLAUDE.md §6.3). Prices always come from the
 * order, never from the assistant.
 */

type Product = Pick<Doc<'products'>, 'name' | 'pricePesewas'>
type Order = Pick<Doc<'orders'>, '_id' | 'number' | 'items' | 'subtotalPesewas' | 'totalPesewas' | 'address'> &
  Partial<
    Pick<
      Doc<'orders'>,
      'recipientName' | 'recipientPhone' | 'location' | 'digitalAddress' | 'deliveryFeePesewas' | 'paymentMethod' | 'cashDuePesewas'
    >
  >

/** For cash orders: what the rider collects. */
function cashLine(order: Order): string {
  return order.paymentMethod === 'cash' && order.cashDuePesewas ? `Please have ${formatCedis(order.cashDuePesewas)} ready in cash for the rider.` : ''
}

/** "Ama (024 123 4567)", "Ama", "024 123 4567", or null when the buyer receives it. */
export function receiverLabel(order: Pick<Order, 'recipientName' | 'recipientPhone'>): string | null {
  const phone = order.recipientPhone ? formatGhanaPhone(order.recipientPhone) : null
  if (order.recipientName && phone) return `${order.recipientName} (${phone})`
  return order.recipientName ?? phone
}

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

  pictureMatched(product: Product) {
    return `That looks like our ${product.name} (${formatCedis(product.pricePesewas)}). I've added 1 to your order.`
  },

  pictureChoose(products: Product[]) {
    const lines = products.map((p, i) => `${i + 1}. ${p.name}: ${formatCedis(p.pricePesewas)}`).join('\n')
    return `Is it one of these?\n\n${lines}\n\nReply with the name of the one you want.`
  },

  pictureSoldOut(product: Product) {
    return `That looks like our ${product.name}, but it's sold out right now.`
  },

  pictureNoMatch(business: string, products: Product[]) {
    const list = catalogue(products)
    return list
      ? `Thanks for the picture. I couldn't find that exact item, so someone from ${business} will check and reply. Here is what we have:\n\n${list}`
      : `Thanks for the picture. Someone from ${business} will check and reply shortly.`
  },

  pictureReceived(business: string) {
    return `Thanks for the picture. Someone from ${business} will look at it and reply shortly.`
  },

  unsupportedMedia(business: string) {
    return `Thanks. I can only read text messages here, so someone from ${business} will look at this and reply shortly.`
  },

  orderLines(order: Order) {
    const lines = order.items.map((i) => `${i.qty} × ${i.name} — ${formatCedis(i.unitPricePesewas * i.qty)}`)
    const delivery = order.deliveryFeePesewas ?? 0
    if (delivery > 0) lines.push(`Delivery — ${formatCedis(delivery)}`)
    return `${lines.join('\n')}\nTotal: ${formatCedis(order.subtotalPesewas + delivery)}`
  },

  askAddress(order: Order) {
    return `Here is your order:\n\n${copy.orderLines(order)}\n\nWhere should we deliver it? You can type the address or share your location.`
  },

  confirm(order: Order, usingSavedAddress: boolean, cashOffered = false) {
    const lines = [`Delivery to: ${order.address}`]
    const receiver = receiverLabel(order)
    if (receiver) lines.push(`Receiver: ${receiver}`)
    if (usingSavedAddress) lines.push('(Reply with a new address to change it.)')
    const pinTip =
      !order.location && !order.digitalAddress
        ? '\n\nTo help the rider find the place, you can also share the location pin (tap + or the clip icon, then Location) or a Ghana Post digital address like GA-123-4567.'
        : ''
    const delivery = order.deliveryFeePesewas ?? 0
    const ask = cashOffered
      ? `Reply YES to pay now with mobile money or card, or CASH to pay the rider when it arrives.${
          delivery > 0
            ? ` With cash, you pay the ${formatCedis(delivery)} delivery fee now and ${formatCedis(order.subtotalPesewas)} to the rider.`
            : ''
        } You can also tell me what to change.`
      : 'Reply YES to confirm, or tell me what to change.'
    return `Please confirm your order:\n\n${copy.orderLines(order)}\n${lines.join('\n')}${pinTip}\n\n${ask}`
  },

  cashNotAvailable(business: string) {
    return `Sorry, ${business} can only take payment online for this order. Reply YES to get your payment link.`
  },

  cashConfirmed(order: Order, business: string) {
    return `Thank you. Order ${orderLabel(order)} is confirmed. ${cashLine(order)} ${business} will let you know when it's on the way.`
  },

  recipientPhoneUnreadable(name: string | null) {
    return `I couldn't read ${name ? `${name}'s` : 'the receiver’s'} phone number. Please send it like 024 123 4567.`
  },

  outsideDeliveryArea(business: string, areas: string) {
    return `Note: ${business} usually delivers to ${areas}. They will check whether they can reach this address and let you know.`
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
    if (order.paymentMethod === 'cash') {
      return `Thank you. To confirm order ${orderLabel(order)}, pay the ${formatCedis(order.deliveryFeePesewas ?? 0)} delivery fee here with mobile money or card:\n${url}\n\nThen pay ${formatCedis(order.cashDuePesewas ?? 0)} in cash to the rider when your order arrives.`
    }
    return `Thank you. Your order ${orderLabel(order)} comes to ${formatCedis(order.totalPesewas)}.\n\nPay here with mobile money or card:\n${url}\n\nWe'll start on it as soon as payment comes through.`
  },

  payLinkDelayed(business: string) {
    return `Thank you. ${business} will send your payment link shortly.`
  },

  paid(order: Order, business: string) {
    if (order.paymentMethod === 'cash') {
      return `Delivery fee received for order ${orderLabel(order)}. Thank you. ${cashLine(order)} ${business} will let you know when it's on the way.`
    }
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
    const cash = cashLine(order)
    return `Your order ${orderLabel(order)} from ${business} is on the way with ${riderName}.${cash ? ` ${cash}` : ''}\n\nYour delivery code is ${pin}. Give it to the rider only when you have your order.`
  },

  /** SMS to the person receiving an order someone else placed. */
  recipientPin(business: string, order: Order, buyer: string, riderName: string, pin: string) {
    const hello = order.recipientName ? `Hello ${order.recipientName}. ` : ''
    return `${hello}${buyer} ordered from ${business} for you (order ${orderLabel(order)}). ${riderName} is bringing it. Your delivery code is ${pin}. Give it to the rider only when you have the order.`
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

  riderJob(business: string, order: Order, customer: string, link: string, riderFee?: { pesewas: number; fromCash: boolean }) {
    const money = [
      order.paymentMethod === 'cash' && order.cashDuePesewas ? `Collect ${formatCedis(order.cashDuePesewas)} in cash.` : '',
      riderFee && riderFee.pesewas > 0
        ? riderFee.fromCash
          ? `Your fee: ${formatCedis(riderFee.pesewas)}, kept from the cash. Give ${formatCedis((order.cashDuePesewas ?? 0) - riderFee.pesewas)} to ${business}.`
          : `Your fee: ${formatCedis(riderFee.pesewas)}, paid by ${business}.`
        : '',
    ]
      .filter(Boolean)
      .join(' ')
    return copy.riderJobBase(business, order, customer, link) + (money ? `\n\n${money}` : '')
  },

  riderJobBase(business: string, order: Order, customer: string, link: string) {
    const receiver = receiverLabel(order)
    const who = receiver ? `Deliver to: ${receiver}\nOrdered by: ${customer}` : `Customer: ${customer}`
    const digital = order.digitalAddress ? `\nDigital address: ${order.digitalAddress}` : ''
    return `New delivery for ${business}: order ${orderLabel(order)}.\n${who}\nAddress: ${order.address ?? 'ask the customer'}${digital}\n\nOpen this page for details and to confirm delivery:\n${link}\n\nWhen you hand over the order, ask for the 4-digit delivery code and enter it on that page.`
  },

  riderDelivered(order: Order) {
    return `Code accepted. Order ${orderLabel(order)} is marked delivered. Thank you.`
  },

  riderWrongPin(attemptsLeft: number) {
    return attemptsLeft > 0
      ? `That code isn't right. Check it with the customer and try again (${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left).`
      : `That code isn't right and there are no tries left. The seller has been told.`
  },

  // To the seller, by SMS (Stallo has no number of its own on WhatsApp). Keep these short: 1 SMS part where possible.

  sellerOrderPaid(order: Order, items: string, amount: string) {
    return `Stallo: order ${orderLabel(order)} is paid (${amount}). ${items}. Open your dashboard to send it out.`
  },

  sellerAttention(summary: string) {
    return `Stallo: ${summary.slice(0, 200)}`
  },

  sellerDailySummary(business: string, stats: { orders: number; paid: string; toDeliver: number; attention: number }) {
    return `Stallo, ${business} today: ${stats.orders} orders, ${stats.paid} paid, ${stats.toDeliver} to deliver, ${stats.attention} need attention.`
  },

  sellerWhatsAppDisconnected(business: string) {
    return `Stallo: WhatsApp for ${business} was unlinked, so Stallo can't read or reply to orders. Open Settings > WhatsApp to link it again.`
  },
}
