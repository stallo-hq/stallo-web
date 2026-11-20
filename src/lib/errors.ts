import { ConvexError } from 'convex/values'

/**
 * Text to show for a failed call. Our Convex functions throw
 * ConvexError({ code, message }) or ConvexError("message") with user-facing text.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data
    if (typeof data === 'string') return data
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return data.message
  }
  return fallback
}
