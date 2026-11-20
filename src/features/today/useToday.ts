import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

/** Everything Today shows, as one live subscription. `undefined` while loading. */
export function useToday() {
  return useQuery(api.dashboard.today)
}
