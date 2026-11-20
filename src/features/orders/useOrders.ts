import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { OrderFilter } from './orderStatus'

export function useOrders(filter: OrderFilter) {
  return useQuery(api.orders.list, { filter })
}
