import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

/** Everything the Overview shows, as one live subscription. `undefined` while loading. */
export function useOverview() {
  return useQuery(api.dashboard.today)
}

export function useResolveAttention() {
  return useMutation(api.attention.resolve)
}
