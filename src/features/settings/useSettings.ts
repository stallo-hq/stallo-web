import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'

export function useSettingsActions() {
  const updateBusinessName = useMutation(api.sellers.updateBusinessName)
  const requestSetup = useMutation(api.sellers.requestSetup)
  return { updateBusinessName, requestSetup }
}
