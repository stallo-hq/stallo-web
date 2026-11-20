/**
 * Ghana phone numbers. Stored as E.164 (+233XXXXXXXXX); shown as 024 123 4567.
 */

/** Returns +233XXXXXXXXX, or null if the input isn't a valid Ghana mobile number. */
export function toE164Ghana(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '')
  let national: string
  if (/^\+233\d{9}$/.test(digits)) national = digits.slice(4)
  else if (/^233\d{9}$/.test(digits)) national = digits.slice(3)
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1)
  else return null
  // Mobile numbers start with 2 or 5 after the leading 0 (e.g. 024, 055, 020).
  if (!/^[25]/.test(national)) return null
  return `+233${national}`
}

/** +233241234567 → 024 123 4567 */
export function formatGhanaPhone(e164: string): string {
  if (!e164.startsWith('+233') || e164.length !== 13) return e164
  const n = `0${e164.slice(4)}`
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
}
