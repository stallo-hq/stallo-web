import { ConvexError } from 'convex/values'

/** Shared input rules. Functions call these instead of repeating checks. */

export const LIMITS = {
  businessName: { min: 2, max: 80 },
  productName: { min: 1, max: 80 },
  // GH₵ 0.01 to GH₵ 1,000,000.00
  pricePesewas: { min: 1, max: 100_000_000 },
  stock: { min: 0, max: 1_000_000 },
} as const

export function cleanText(value: string, label: string, limits: { min: number; max: number }): string {
  const text = value.trim().replace(/\s+/g, ' ')
  if (text.length < limits.min || text.length > limits.max) {
    throw new ConvexError(
      limits.min <= 1
        ? `${label} must be at most ${limits.max} characters`
        : `${label} must be ${limits.min} to ${limits.max} characters`,
    )
  }
  return text
}

export function checkWholeNumber(
  value: number,
  label: string,
  limits: { min: number; max: number },
): number {
  if (!Number.isInteger(value) || value < limits.min || value > limits.max) {
    throw new ConvexError(`${label} is out of range`)
  }
  return value
}
