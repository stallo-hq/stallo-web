/** Small Web Crypto helpers (available in the Convex runtime and in tests). */

const encoder = new TextEncoder()

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 32 random bytes as hex. Generate secrets in actions, where randomness is not seeded. */
export function randomToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

/** A random numeric code of `length` digits, without modulo bias. */
export function randomDigits(length: number): string {
  let out = ''
  while (out.length < length) {
    const [n] = crypto.getRandomValues(new Uint8Array(1))
    if (n < 250) out += String(n % 10)
  }
  return out
}

export async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

export async function hmacHex(algorithm: 'SHA-256' | 'SHA-512', key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: algorithm }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data)))
}

/** Compares two hex strings in time that doesn't depend on where they differ. */
export function safeEqualHex(a: string, b: string): boolean {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i)
  return diff === 0
}
