/**
 * WhatsApp Cloud API (Meta Graph API). Server-side only.
 *
 * Env (Convex):
 *   META_APP_ID                     Meta app id (also shown to the browser for Embedded Signup)
 *   WHATSAPP_APP_SECRET             app secret: verifies webhooks, exchanges signup codes
 *   WHATSAPP_VERIFY_TOKEN           any string you choose; paste the same into Meta's webhook settings
 *   WHATSAPP_ACCESS_TOKEN           system-user token for Stallo's own Meta business
 *   WHATSAPP_PLATFORM_PHONE_NUMBER_ID   optional: Stallo's own number, for messages to sellers
 *   WHATSAPP_GRAPH_VERSION          optional, default v27.0
 */
import { hmacHex, safeEqualHex } from '../model/crypto'
import { TEMPLATE_LANGUAGE, templateParam } from '../whatsapp/templates'

export function graphVersion(): string {
  return process.env.WHATSAPP_GRAPH_VERSION || 'v27.0'
}

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${graphVersion()}/${path}`
}

export type WhatsAppErrorKind = 'rate_limited' | 'outside_window' | 'not_configured' | 'invalid_recipient' | 'temporary' | 'rejected'

export class WhatsAppError extends Error {
  readonly kind: WhatsAppErrorKind
  readonly code?: number
  constructor(kind: WhatsAppErrorKind, message: string, code?: number) {
    super(message)
    this.kind = kind
    this.code = code
  }
  get retryable() {
    return this.kind === 'rate_limited' || this.kind === 'temporary'
  }
}

// https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056])
const OUTSIDE_WINDOW_CODES = new Set([131047])
const INVALID_RECIPIENT_CODES = new Set([131026, 131030])

function classify(status: number, body: Record<string, unknown>): WhatsAppError {
  const error = (body.error ?? {}) as { code?: number; message?: string; error_data?: { details?: string } }
  const code = error.code
  const message = error.error_data?.details || error.message || `HTTP ${status}`
  if (code !== undefined && RATE_LIMIT_CODES.has(code)) return new WhatsAppError('rate_limited', message, code)
  if (code !== undefined && OUTSIDE_WINDOW_CODES.has(code)) return new WhatsAppError('outside_window', message, code)
  if (code !== undefined && INVALID_RECIPIENT_CODES.has(code)) return new WhatsAppError('invalid_recipient', message, code)
  if (code === 190 || status === 401) return new WhatsAppError('not_configured', 'WhatsApp access token is invalid or expired', code)
  if (status === 429) return new WhatsAppError('rate_limited', message, code)
  if (status >= 500) return new WhatsAppError('temporary', message, code)
  return new WhatsAppError('rejected', message, code)
}

async function graph<T>(method: 'GET' | 'POST', path: string, token: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(graphUrl(path), {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new WhatsAppError('temporary', 'Could not reach WhatsApp')
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) throw classify(response.status, data)
  return data as T
}

export function platformToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token) throw new WhatsAppError('not_configured', 'WHATSAPP_ACCESS_TOKEN is not set')
  return token
}

export function platformPhoneNumberId(): string | null {
  return process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID || null
}

/** WhatsApp wants the number without "+". */
function waNumber(e164: string): string {
  return e164.replace(/^\+/, '')
}

type SendResult = { messages?: { id: string }[] }

export async function sendText(phoneNumberId: string, token: string, to: string, text: string): Promise<string> {
  const result = await graph<SendResult>('POST', `${phoneNumberId}/messages`, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: waNumber(to),
    type: 'text',
    text: { body: text.slice(0, 4096), preview_url: true },
  })
  return result.messages?.[0]?.id ?? ''
}

export async function sendTemplate(phoneNumberId: string, token: string, to: string, name: string, params: string[]): Promise<string> {
  const result = await graph<SendResult>('POST', `${phoneNumberId}/messages`, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: waNumber(to),
    type: 'template',
    template: {
      name,
      language: { code: TEMPLATE_LANGUAGE },
      components: params.length > 0 ? [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: templateParam(p) })) }] : [],
    },
  })
  return result.messages?.[0]?.id ?? ''
}

export async function getPhoneNumber(phoneNumberId: string, token: string) {
  return await graph<{ id: string; display_phone_number?: string; verified_name?: string }>(
    'GET',
    `${phoneNumberId}?fields=display_phone_number,verified_name`,
    token,
  )
}

// Embedded Signup (https://developers.facebook.com/docs/whatsapp/embedded-signup)

export function signupConfig() {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appId || !appSecret) throw new WhatsAppError('not_configured', 'META_APP_ID and WHATSAPP_APP_SECRET are required')
  return { appId, appSecret }
}

/** Swaps the code from the signup popup for a business token (valid 5 minutes, server-to-server only). */
export async function exchangeCode(code: string): Promise<string> {
  const { appId, appSecret } = signupConfig()
  const query = new URLSearchParams({ client_id: appId, client_secret: appSecret, code })
  let response: Response
  try {
    response = await fetch(`${graphUrl('oauth/access_token')}?${query}`)
  } catch {
    throw new WhatsAppError('temporary', 'Could not reach Meta')
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok || typeof data.access_token !== 'string') throw classify(response.status, data)
  return data.access_token
}

/** Lets Stallo receive this WhatsApp Business Account's webhooks. */
export async function subscribeApp(wabaId: string, token: string): Promise<void> {
  await graph('POST', `${wabaId}/subscribed_apps`, token)
}

/** Registers a new Cloud API number. Numbers that stay on the WhatsApp Business app (coexistence) skip this. */
export async function registerNumber(phoneNumberId: string, token: string, pin: string): Promise<void> {
  await graph('POST', `${phoneNumberId}/register`, token, { messaging_product: 'whatsapp', pin })
}

// Webhooks

/**
 * X-Hub-Signature-256 is "sha256=" + HMAC-SHA256 of the raw body with the app secret.
 * Fails closed: without a configured secret nothing is accepted.
 */
export async function verifyWebhookSignature(rawBody: string, header: string | null): Promise<boolean> {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret || !header?.startsWith('sha256=')) return false
  const expected = await hmacHex('SHA-256', secret, rawBody)
  return safeEqualHex(expected, header.slice('sha256='.length))
}

export type InboundWhatsAppMessage = {
  id: string
  from: string
  timestamp?: string
  type: string
  text?: { body: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  button?: { text: string }
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } }
}

export type WebhookBatch = {
  phoneNumberId: string
  contacts: Map<string, string>
  messages: InboundWhatsAppMessage[]
  statuses: { id: string; status: string; errors?: { code: number; title?: string; message?: string }[] }[]
  /** Replies the seller typed in the WhatsApp Business app on their phone (coexistence numbers only). */
  echoes: SellerEcho[]
}

export type SellerEcho = { id: string; to: string; text: string }

/** What a seller's reply said, for the chat history. Media becomes a short label. */
function echoText(message: InboundWhatsAppMessage): string {
  const text = messageText(message)
  if (text !== null && text.trim() !== '') return text
  const caption = (message as { image?: { caption?: string } }).image?.caption?.trim()
  return caption ? `[${message.type}] ${caption}` : `[${(message.type ?? 'message').replace(/_/g, ' ')}]`
}

/**
 * Pulls messages, delivery statuses and the seller's own replies out of a webhook payload.
 * Replies typed on the phone arrive in the `smb_message_echoes` field, which Meta only sends
 * for numbers that also stay on the WhatsApp Business app.
 */
export function parseWebhook(payload: unknown): WebhookBatch[] {
  const batches: WebhookBatch[] = []
  const entries = (payload as { entry?: unknown[] })?.entry ?? []
  for (const entry of entries) {
    for (const change of (entry as { changes?: unknown[] }).changes ?? []) {
      const { field, value } = change as { field?: string; value?: Record<string, unknown> }
      if ((field !== 'messages' && field !== 'smb_message_echoes') || !value) continue
      const metadata = value.metadata as { phone_number_id?: string } | undefined
      if (!metadata?.phone_number_id) continue
      if (field === 'smb_message_echoes') {
        const echoes = ((value.message_echoes as (InboundWhatsAppMessage & { to?: string })[] | undefined) ?? [])
          .filter((m) => m?.id && m?.to)
          .map((m) => ({ id: m.id, to: m.to!, text: echoText(m).slice(0, 500) }))
        batches.push({ phoneNumberId: metadata.phone_number_id, contacts: new Map(), messages: [], statuses: [], echoes })
        continue
      }
      const contacts = new Map<string, string>()
      for (const c of (value.contacts as { wa_id?: string; profile?: { name?: string } }[] | undefined) ?? []) {
        if (c.wa_id && c.profile?.name) contacts.set(c.wa_id, c.profile.name)
      }
      batches.push({
        phoneNumberId: metadata.phone_number_id,
        contacts,
        messages: ((value.messages as InboundWhatsAppMessage[] | undefined) ?? []).filter((m) => m?.id && m?.from),
        statuses: (value.statuses as WebhookBatch['statuses'] | undefined) ?? [],
        echoes: [],
      })
    }
  }
  return batches
}

/** The words in a message, whatever kind it is. Null for media we can't read. */
export function messageText(message: InboundWhatsAppMessage): string | null {
  if (message.type === 'text') return message.text?.body ?? null
  if (message.type === 'button') return message.button?.text ?? null
  if (message.type === 'interactive') return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? null
  return null
}

/** Biggest customer picture we copy from WhatsApp. */
const MAX_MEDIA_BYTES = 5 * 1024 * 1024

/** Downloads a picture a customer sent. WhatsApp keeps media for a limited time, so copy it promptly. */
export async function downloadMedia(mediaId: string, token: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const info = await graph<{ url?: string; mime_type?: string; file_size?: number }>('GET', mediaId, token)
  if (!info.url) throw new WhatsAppError('rejected', 'WhatsApp returned no media link')
  if (info.file_size && info.file_size > MAX_MEDIA_BYTES) throw new WhatsAppError('rejected', 'Picture is too large')
  let response: Response
  try {
    response = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    throw new WhatsAppError('temporary', 'Could not download the picture from WhatsApp')
  }
  if (!response.ok) throw classify(response.status, {})
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > MAX_MEDIA_BYTES) throw new WhatsAppError('rejected', 'Picture is too large')
  return { bytes, mimeType: info.mime_type || response.headers.get('content-type') || 'image/jpeg' }
}
