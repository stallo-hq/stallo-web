import type { Tone } from '../../components/ui/Badge'

export type ConnectionState = 'connected' | 'requested' | 'none'

/** Label and colour for a connection (WhatsApp, payouts). One source for every screen that shows it. */
export function connectionStatus(
  connected: boolean,
  requestedAt: number | undefined,
): { label: string; tone: Tone; state: ConnectionState } {
  if (connected) return { label: 'Connected', tone: 'green', state: 'connected' }
  if (requestedAt !== undefined) return { label: 'Setup requested', tone: 'amber', state: 'requested' }
  return { label: 'Not connected', tone: 'gray', state: 'none' }
}
