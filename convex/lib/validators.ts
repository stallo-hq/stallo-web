import { v } from 'convex/values'

/**
 * Status values shared by the schema and the functions.
 * Changing these is a contract change (see CLAUDE.md §5): the backend uses the same strings.
 */

export const orderStatus = v.union(
  v.literal('draft'),
  v.literal('awaiting_confirmation'),
  v.literal('awaiting_payment'),
  v.literal('paid'),
  v.literal('dispatched'),
  v.literal('delivered'),
  v.literal('delivery_failed'),
  v.literal('returned'),
  v.literal('cancelled'),
)

export const paymentStatus = v.union(
  v.literal('none'),
  v.literal('pending'),
  v.literal('paid'),
  v.literal('failed'),
  v.literal('refunded'),
)

export const conversationState = v.union(
  v.literal('idle'),
  v.literal('collecting'),
  v.literal('awaiting_confirmation'),
)

export const processingStatus = v.union(
  v.literal('pending'),
  v.literal('done'),
  v.literal('failed'),
)

export const deliveryStatus = v.union(
  v.literal('dispatched'),
  v.literal('delivered'),
  v.literal('failed'),
  v.literal('returned'),
)

export const attentionType = v.union(
  v.literal('low_confidence'),
  v.literal('payment_failed'),
  v.literal('delivery_failed'),
  v.literal('stock_problem'),
  v.literal('processing_failed'),
)

export const onboardingState = v.union(
  v.literal('profile'),
  v.literal('whatsapp'),
  v.literal('payouts'),
  v.literal('done'),
)
