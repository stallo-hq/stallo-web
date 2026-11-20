/**
 * Ghana phone numbers, stored as E.164 (+233XXXXXXXXX). Shared by the Convex
 * backend and the web app so both accept exactly the same input.
 */

/** Returns +233XXXXXXXXX, or null if the input isn't a valid Ghana mobile number. */
export function toE164Ghana(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '')
  let national: string
  if (/^\+233\d{9}$/.test(digits)) national = digits.slice(4)
  else if (/^233\d{9}$/.test(digits)) national = digits.slice(3)
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1)
  else if (/^\d{9}$/.test(digits)) national = digits
  else return null
  // Mobile numbers start with 2 or 5 after the leading 0 (e.g. 024, 055, 020).
  if (!/^[25]/.test(national)) return null
  return `+233${national}`
}
