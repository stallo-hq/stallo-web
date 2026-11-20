import type { RefObject } from 'react'

/**
 * Read an IonInput's current value at submit time. Pressing Enter can submit
 * before the last keystroke's input event updates React state, so forms read
 * the element directly instead of relying on state.
 */
export function inputValue(ref: RefObject<HTMLIonInputElement | null>): string {
  const value = ref.current?.value
  return value === null || value === undefined ? '' : String(value)
}
