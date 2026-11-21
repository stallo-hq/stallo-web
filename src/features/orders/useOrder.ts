import { useAction, useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export type OrderDetail = NonNullable<FunctionReturnType<typeof api.orders.get>>

/** One order, live, plus everything the seller can do with it. */
export function useOrder(orderId: Id<'orders'>) {
  return {
    order: useQuery(api.orders.get, { orderId }),
    dispatch: useAction(api.deliveries.dispatch),
    markFailed: useMutation(api.deliveries.markFailed),
    markReturned: useMutation(api.deliveries.markReturned),
    markCashReceived: useMutation(api.deliveries.markCashReceived),
    cancel: useAction(api.payments.cancelOrder),
    refund: useAction(api.payments.refundOrder),
    resendLink: useAction(api.payments.resendLink),
    resolve: useMutation(api.attention.resolve),
    letStalloReply: useMutation(api.conversations.letStalloReply),
  }
}
