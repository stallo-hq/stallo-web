import type { Doc } from '../../../convex/_generated/dataModel'
import type { Tone } from '../../components/ui/Badge'

export type OrderStatus = Doc<'orders'>['status']
export type PaymentStatus = Doc<'orders'>['paymentStatus']

/** The one place order statuses get their label and colour. */
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  draft: { label: 'In chat', tone: 'gray' },
  awaiting_confirmation: { label: 'Confirming', tone: 'amber' },
  awaiting_payment: { label: 'Awaiting payment', tone: 'amber' },
  paid: { label: 'Paid · to deliver', tone: 'green' },
  dispatched: { label: 'Out for delivery', tone: 'blue' },
  delivered: { label: 'Delivered', tone: 'gray' },
  delivery_failed: { label: 'Delivery failed', tone: 'red' },
  returned: { label: 'Returned', tone: 'gray' },
  cancelled: { label: 'Cancelled', tone: 'red' },
}

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  none: { label: 'Not requested', tone: 'gray' },
  pending: { label: 'Pending', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  refunded: { label: 'Refunded', tone: 'gray' },
}

export type OrderFilter = 'active' | 'delivered' | 'all'

export const FILTERS: { value: OrderFilter; label: string; emptyTitle: string; emptyMessage: string }[] = [
  {
    value: 'active',
    label: 'Active',
    emptyTitle: 'No orders in progress',
    emptyMessage: 'New WhatsApp orders appear here while they’re being paid for and delivered.',
  },
  {
    value: 'delivered',
    label: 'Delivered',
    emptyTitle: 'No deliveries yet',
    emptyMessage: 'Orders move here once the rider confirms the customer’s PIN.',
  },
  {
    value: 'all',
    label: 'All',
    emptyTitle: 'No orders yet',
    emptyMessage: 'Every order your customers place on WhatsApp will be listed here.',
  },
]

export type DeliveryStatus = Doc<'deliveries'>['status']

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; tone: Tone }> = {
  dispatched: { label: 'With the rider', tone: 'blue' },
  delivered: { label: 'Delivered', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  returned: { label: 'Returned', tone: 'gray' },
}
