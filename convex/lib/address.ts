/**
 * Ghana Post digital addresses (GhanaPost GPS), e.g. GA-183-8164: two letters
 * for the region and district, then two groups of 3 or 4 digits. Shared by the
 * Convex backend and the web app.
 */
const DIGITAL_ADDRESS = /\b([A-Za-z]{2})[\s-]?(\d{3,4})[\s-]?(\d{3,4})\b/

/** Finds a digital address in free text and returns it as GA-183-8164, or null. */
export function findDigitalAddress(text: string): string | null {
  const match = DIGITAL_ADDRESS.exec(text)
  if (!match) return null
  const [, letters, district, unique] = match
  // Both digit groups written together (GA1838164) is too easy to confuse with other numbers.
  if (!/[\s-]/.test(match[0])) return null
  return `${letters.toUpperCase()}-${district}-${unique}`
}

/** A map link for the rider: the exact pin when we have one, else a search for the address. */
export function mapsUrl(order: { location?: { lat: number; lng: number }; digitalAddress?: string; address?: string }): string | undefined {
  if (order.location) return `https://maps.google.com/?q=${order.location.lat},${order.location.lng}`
  const query = order.digitalAddress ?? order.address
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : undefined
}
