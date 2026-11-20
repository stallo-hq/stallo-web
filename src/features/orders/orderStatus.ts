import type { Doc } from '../../../convex/_generated/dataModel'

type OrderStatus = Doc<'orders'>['status']

/** The one place order statuses get their label and colour (Ionic semantic colours). */
export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'medium' },
  awaiting_confirmation: { label: 'Confirming', color: 'warning' },
  awaiting_payment: { label: 'Awaiting payment', color: 'warning' },
  paid: { label: 'Paid · to deliver', color: 'success' },
  dispatched: { label: 'Out for delivery', color: 'primary' },
  delivered: { label: 'Delivered', color: 'success' },
  delivery_failed: { label: 'Delivery failed', color: 'danger' },
  returned: { label: 'Returned', color: 'medium' },
  cancelled: { label: 'Cancelled', color: 'danger' },
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
