/** Ghana phone numbers. Stored as E.164 (+233XXXXXXXXX); shown as 024 123 4567. */
export { toE164Ghana } from '../../convex/lib/phone'

/** +233241234567 → 024 123 4567 */
export function formatGhanaPhone(e164: string): string {
  if (!e164.startsWith('+233') || e164.length !== 13) return e164
  const n = `0${e164.slice(4)}`
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
}
