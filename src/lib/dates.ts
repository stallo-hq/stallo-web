/** Dates are shown in Ghana time (GMT, no daylight saving). */
const TIME_ZONE = 'Africa/Accra'

export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TIME_ZONE }).format(now),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** "Friday 20 November" */
export function formatLongDate(date: Date | number = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TIME_ZONE,
  }).format(date)
}

/** "14:05" today, otherwise "20 Nov, 14:05" */
export function formatShortDateTime(timestamp: number, now: number = Date.now()): string {
  const sameDay =
    new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeZone: TIME_ZONE }).format(timestamp) ===
    new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeZone: TIME_ZONE }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(timestamp)
  if (sameDay) return time
  const day = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(timestamp)
  return `${day}, ${time}`
}
