/** Label and colour for a connection (WhatsApp, payouts). One source for Settings and the detail pages. */
export function connectionStatus(
  connected: boolean,
  requestedAt: number | undefined,
): { label: string; color: string; state: 'connected' | 'requested' | 'none' } {
  if (connected) return { label: 'Connected', color: 'success', state: 'connected' }
  if (requestedAt !== undefined) return { label: 'Requested', color: 'warning', state: 'requested' }
  return { label: 'Not set up', color: 'medium', state: 'none' }
}
