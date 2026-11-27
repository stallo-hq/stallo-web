import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { TrackerRange } from '../../../convex/model/tracker'

/** Everything the Overview shows, as one live subscription. `undefined` while loading. */
export function useOverview() {
  return useQuery(api.dashboard.today)
}

export function useTracker(range: TrackerRange) {
  return useQuery(api.dashboard.tracker, { range })
}

export function useResolveAttention() {
  return useMutation(api.attention.resolve)
}
