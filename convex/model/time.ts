/** Ghana uses GMT all year (UTC+0, no daylight saving), so "today" starts at UTC midnight. */
export function startOfTodayAccra(now: number = Date.now()): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
