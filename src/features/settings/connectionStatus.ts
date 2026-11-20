import type { Tone } from '../../components/ui/Badge'

/** Label and colour for a connection (WhatsApp, payouts). One source for every screen that shows it. */
export function connectionStatus(connected: boolean): { label: string; tone: Tone } {
  return connected ? { label: 'Connected', tone: 'green' } : { label: 'Not connected', tone: 'gray' }
}
