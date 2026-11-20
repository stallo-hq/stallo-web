import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

export function useSettingsActions() {
  const updateBusinessName = useMutation(api.sellers.updateBusinessName)
  const changePassword = useMutation(api.auth.changePassword)
  return { updateBusinessName, changePassword }
}

/** Which integrations are switched on for this Stallo deployment. */
export function useIntegrations() {
  return useQuery(api.site.integrations)
}

export function useWhatsAppConnection() {
  return {
    completeSignup: useAction(api.whatsappConnect.completeSignup),
    connectManually: useAction(api.whatsappConnect.connectManually),
    disconnect: useMutation(api.whatsappConnect.disconnect),
  }
}

export function usePayoutActions() {
  return {
    providers: useAction(api.payouts.providers),
    connect: useAction(api.payouts.connect),
  }
}
