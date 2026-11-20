/**
 * Subtle haptic feedback for state changes. Uses the Vibration API where the
 * browser supports it (Android Chrome). iOS Safari has no web haptics, so this
 * does nothing there. Never awaits and never throws.
 */

type Kind = 'light' | 'success' | 'error'

const PATTERNS: Record<Kind, number | number[]> = {
  light: 10,
  success: [12, 60, 12],
  error: [30, 50, 30, 50, 30],
}

export function haptic(kind: Kind = 'light'): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(PATTERNS[kind])
    }
  } catch {
    // Feedback is optional.
  }
}
