import { hmacHex } from '../convex/model/crypto'

/** Test helpers for the Evolution API webhook (ADR 0002). */

export const WEBHOOK_SECRET = 'evolution-webhook-secret-0123456789abcdef'

function b64url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The Authorization header Evolution sends when the webhook headers contain `jwt_key`. */
export async function evolutionAuth(
  secret = WEBHOOK_SECRET,
  claims: Record<string, unknown> = {},
  iat = Math.floor(Date.now() / 1000),
): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ iat, exp: iat + 600, app: 'evolution', action: 'webhook', ...claims }))
  const hex = await hmacHex('SHA-256', secret, `${head}.${payload}`)
  const sig = b64url(String.fromCharCode(...(hex.match(/../g) ?? []).map((h) => parseInt(h, 16))))
  return `Bearer ${head}.${payload}.${sig}`
}

export function b64urlJson(value: unknown): string {
  return b64url(JSON.stringify(value))
}

/** A messages.upsert delivery as Evolution v2 sends it. */
export function upsert(instance: string, data: Record<string, unknown>) {
  return { event: 'messages.upsert', instance, data, date_time: '2026-11-23T10:00:00', sender: '233200000000@s.whatsapp.net', apikey: null }
}

/** A plain text message from `from` (digits, no "+"). */
export function textUpsert(instance: string, from: string, text: string, id: string, fromMe = false, pushName = 'Kofi') {
  return upsert(instance, {
    key: { remoteJid: `${from}@s.whatsapp.net`, fromMe, id },
    pushName: fromMe ? 'Você' : pushName,
    messageType: 'conversation',
    message: { conversation: text },
    messageTimestamp: Math.floor(Date.now() / 1000),
  })
}
