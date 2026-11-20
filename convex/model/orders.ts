import type { Doc } from '../_generated/dataModel'

/** Orders still in progress (shown under "Active"). Drafts are never listed. */
export const ACTIVE_STATUSES: ReadonlySet<Doc<'orders'>['status']> = new Set([
  'awaiting_confirmation',
  'awaiting_payment',
  'paid',
  'dispatched',
  'delivery_failed',
])
