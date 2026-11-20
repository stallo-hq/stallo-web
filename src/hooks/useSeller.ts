import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/** The signed-in seller's profile, live. `undefined` while loading, `null` if not set up. */
export function useSeller() {
  return useQuery(api.sellers.mine)
}
