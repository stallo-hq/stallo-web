/**
 * Evolution API v2 (self-hosted WhatsApp linked-device gateway). Server-side only.
 * Checked against evolution-foundation/evolution-api v2.3.7 source; see ADR 0002.
 *
 * Env (Convex):
 *   EVOLUTION_API_URL          base URL of our Evolution server, e.g. https://wa.example.com
 *   EVOLUTION_API_KEY          Evolution's AUTHENTICATION_API_KEY (sent as the `apikey` header)
 *   EVOLUTION_WEBHOOK_SECRET   random string, at least 32 characters. Evolution signs a short-lived
 *                              token with it on every webhook; we reject anything else.
 */
import { hmacHex } from '../model/crypto'

export type EvolutionErrorKind = 'not_configured' | 'not_found' | 'invalid_recipient' | 'temporary' | 'rejected'

export class EvolutionError extends Error {
  readonly kind: EvolutionErrorKind
  readonly status?: number
  constructor(kind: EvolutionErrorKind, message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
  }
  get retryable() {
    return this.kind === 'temporary'
  }
}

export function evolutionConfigured(): boolean {
  return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && webhookSecret())
}

function config() {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/$/, '')
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) throw new EvolutionError('not_configured', 'EVOLUTION_API_URL and EVOLUTION_API_KEY are required')
  return { url, key }
}

function webhookSecret(): string | null {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET
  return secret && secret.length >= 32 ? secret : null
}

function messageOf(body: unknown, status: number): string {
  const b = body as { response?: { message?: unknown }; message?: unknown; error?: unknown } | null
  const raw = b?.response?.message ?? b?.message ?? b?.error
  const text = Array.isArray(raw) ? raw.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('; ') : raw
  return typeof text === 'string' && text ? text : `HTTP ${status}`
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const { url, key } = config()
  let response: Response
  try {
    response = await fetch(`${url}${path}`, {
      method,
      headers: { apikey: key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new EvolutionError('temporary', 'Could not reach the WhatsApp server')
  }
  const data = (await response.json().catch(() => ({}))) as unknown
  if (response.ok) return data as T
  const message = messageOf(data, response.status)
  if (response.status === 401 || response.status === 403) throw new EvolutionError('not_configured', 'The WhatsApp server rejected Stallo’s API key', response.status)
  if (response.status === 404) throw new EvolutionError('not_found', message, response.status)
  if (response.status === 429 || response.status >= 500) throw new EvolutionError('temporary', message, response.status)
  if (/exists"?\s*:\s*false|not.*whatsapp/i.test(message)) throw new EvolutionError('invalid_recipient', 'This number is not on WhatsApp', response.status)
  throw new EvolutionError('rejected', message, response.status)
}

const enc = encodeURIComponent

// Sessions (one Evolution "instance" per seller)

export const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'] as const

function webhookConfig(webhookUrl: string) {
  const secret = webhookSecret()
  if (!secret) throw new EvolutionError('not_configured', 'EVOLUTION_WEBHOOK_SECRET must be set (32+ characters)')
  // `jwt_key` makes Evolution send "Authorization: Bearer <HS256 token>" signed with our secret.
  return { enabled: true, url: webhookUrl, byEvents: false, base64: false, headers: { jwt_key: secret }, events: [...WEBHOOK_EVENTS] }
}

type QrResult = { base64?: string | null; code?: string | null; pairingCode?: string | null }

/** Creates the session and returns the first QR code (a PNG data URL), if Evolution sent one. */
export async function createInstance(instance: string, webhookUrl: string): Promise<string | null> {
  const result = await call<{ qrcode?: QrResult }>('POST', '/instance/create', {
    instanceName: instance,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    webhook: webhookConfig(webhookUrl),
  })
  return result.qrcode?.base64 || null
}

/** Points the session's webhook at Stallo (again), e.g. after the secret changes. */
export async function setWebhook(instance: string, webhookUrl: string): Promise<void> {
  await call('POST', `/webhook/set/${enc(instance)}`, { webhook: webhookConfig(webhookUrl) })
}

/** Asks for a fresh QR code for an existing session. */
export async function connectInstance(instance: string): Promise<string | null> {
  const result = await call<QrResult>('GET', `/instance/connect/${enc(instance)}`)
  return result.base64 || null
}

export type SessionState = 'open' | 'connecting' | 'close'

export async function connectionState(instance: string): Promise<SessionState> {
  const result = await call<{ instance?: { state?: string } }>('GET', `/instance/connectionState/${enc(instance)}`)
  const state = result.instance?.state
  return state === 'open' || state === 'connecting' ? state : 'close'
}

/** Unlinks the device and removes the session. Missing sessions are fine. */
export async function removeInstance(instance: string): Promise<void> {
  for (const path of [`/instance/logout/${enc(instance)}`, `/instance/delete/${enc(instance)}`]) {
    try {
      await call('DELETE', path)
    } catch (error) {
      if (!(error instanceof EvolutionError) || (error.kind !== 'not_found' && error.kind !== 'rejected')) throw error
    }
  }
}

// Messages

/** Evolution wants the number without "+". */
function waNumber(e164: string): string {
  return e164.replace(/^\+/, '')
}

/**
 * Sends a text. With `typingMs`, Evolution shows "typing…" for that long first
 * (it holds the request open meanwhile). Returns WhatsApp's message id.
 */
export async function sendText(instance: string, to: string, text: string, typingMs = 0): Promise<string> {
  const result = await call<{ key?: { id?: string } }>('POST', `/message/sendText/${enc(instance)}`, {
    number: waNumber(to),
    text: text.slice(0, 4096),
    linkPreview: true,
    ...(typingMs > 0 ? { delay: Math.round(typingMs) } : {}),
  })
  return result.key?.id ?? ''
}

/** Blue ticks on the customer's message. */
export async function markRead(instance: string, message: { jid: string; id: string }): Promise<void> {
  await call('POST', `/chat/markMessageAsRead/${enc(instance)}`, {
    readMessages: [{ remoteJid: message.jid, fromMe: false, id: message.id }],
  })
}

/** Biggest customer picture we copy. */
const MAX_MEDIA_BYTES = 5 * 1024 * 1024

/** Downloads a picture a customer sent (Evolution keeps the message, so the key is enough). */
export async function downloadMedia(instance: string, message: { jid: string; id: string }): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const result = await call<{ base64?: string; mimetype?: string } | null>('POST', `/chat/getBase64FromMediaMessage/${enc(instance)}`, {
    message: { key: { remoteJid: message.jid, fromMe: false, id: message.id } },
    convertToMp4: false,
  })
  if (!result?.base64) throw new EvolutionError('rejected', 'WhatsApp returned no picture')
  if (result.base64.length > (MAX_MEDIA_BYTES * 4) / 3 + 4) throw new EvolutionError('rejected', 'Picture is too large')
  const binary = atob(result.base64.replace(/^data:[^,]*,/, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { bytes, mimeType: result.mimetype?.split(';')[0] || 'image/jpeg' }
}

// Webhooks

function base64UrlToString(value: string): string {
  return atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='))
}

function hexToBase64Url(hex: string): string {
  let binary = ''
  for (let i = 0; i < hex.length; i += 2) binary += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Evolution sends "Authorization: Bearer <JWT>", HS256-signed with EVOLUTION_WEBHOOK_SECRET,
 * valid for 10 minutes. Fails closed: without a configured secret nothing is accepted.
 */
export async function verifyWebhookAuth(header: string | null, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const secret = webhookSecret()
  if (!secret || !header?.startsWith('Bearer ')) return false
  const parts = header.slice('Bearer '.length).trim().split('.')
  if (parts.length !== 3) return false
  const [head, body, signature] = parts
  try {
    const expected = hexToBase64Url(await hmacHex('SHA-256', secret, `${head}.${body}`))
    if (!safeEqual(expected, signature)) return false
    const h = JSON.parse(base64UrlToString(head)) as { alg?: string }
    const claims = JSON.parse(base64UrlToString(body)) as { exp?: number; iat?: number; app?: string; action?: string }
    if (h.alg !== 'HS256' || claims.app !== 'evolution' || claims.action !== 'webhook') return false
    if (typeof claims.exp !== 'number' || claims.exp < nowSeconds - 30) return false
    if (typeof claims.iat === 'number' && claims.iat > nowSeconds + 60) return false
    return true
  } catch {
    return false
  }
}

/**
 * A WhatsApp message in the shape Stallo stores (`inboundMessages.raw`).
 * `from` is digits only; `jid` is WhatsApp's chat id, needed for read receipts and media.
 */
export type InboundWhatsAppMessage = {
  id: string
  from: string
  jid: string
  timestamp?: number
  type: string
  text?: { body: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  image?: { caption?: string }
}

export type WebhookEvent =
  | { kind: 'message'; instance: string; fromMe: boolean; profileName?: string; message: InboundWhatsAppMessage }
  | { kind: 'connection'; instance: string; state: SessionState | 'refused'; phone?: string }
  | { kind: 'qr'; instance: string; qr: string | null }
  | { kind: 'ignore' }

/** Message kinds that aren't something a person said (edits, deletes, reactions, key exchanges). */
const IGNORED_TYPES = new Set(['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage', 'messageContextInfo', 'pollUpdateMessage', 'editedMessage'])

/** "233241234567@s.whatsapp.net" → "233241234567". Null for groups, broadcasts, channels and unresolved @lid ids. */
export function phoneFromJid(jid: string | undefined): string | null {
  if (!jid || !jid.endsWith('@s.whatsapp.net')) return null
  const digits = jid.split('@')[0].split(':')[0]
  return /^\d{6,15}$/.test(digits) ? digits : null
}

function normalise(data: Record<string, unknown>): { message: InboundWhatsAppMessage; fromMe: boolean; profileName?: string } | null {
  const key = (data.key ?? {}) as { id?: string; remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean }
  const jid = key.remoteJid?.endsWith('@lid') && key.remoteJidAlt ? key.remoteJidAlt : key.remoteJid
  const from = phoneFromJid(jid)
  const messageType = typeof data.messageType === 'string' ? data.messageType : ''
  if (!key.id || !jid || !from || !messageType || IGNORED_TYPES.has(messageType)) return null
  const m = (data.message ?? {}) as Record<string, Record<string, unknown> | string | undefined>
  const base = {
    id: key.id,
    from,
    jid,
    timestamp: typeof data.messageTimestamp === 'number' ? data.messageTimestamp : undefined,
  }
  const fromMe = key.fromMe === true
  const profileName = !fromMe && typeof data.pushName === 'string' && data.pushName.trim() ? data.pushName.trim().slice(0, 80) : undefined
  const sub = (name: string) => (typeof m[name] === 'object' ? (m[name] as Record<string, unknown>) : undefined)
  const str = (value: unknown) => (typeof value === 'string' ? value : undefined)

  let message: InboundWhatsAppMessage
  if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
    const body = str(m.conversation) ?? str(sub('extendedTextMessage')?.text) ?? ''
    message = { ...base, type: 'text', text: { body } }
  } else if (messageType === 'buttonsResponseMessage' || messageType === 'listResponseMessage' || messageType === 'templateButtonReplyMessage') {
    const r = sub(messageType)
    const body = str(r?.selectedDisplayText) ?? str(r?.title) ?? str(r?.selectedButtonId) ?? ''
    message = { ...base, type: 'text', text: { body } }
  } else if (messageType === 'imageMessage') {
    message = { ...base, type: 'image', image: { caption: str(sub('imageMessage')?.caption) } }
  } else if (messageType === 'locationMessage' || messageType === 'liveLocationMessage') {
    const l = sub(messageType) ?? {}
    const latitude = Number(l.degreesLatitude)
    const longitude = Number(l.degreesLongitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    message = { ...base, type: 'location', location: { latitude, longitude, name: str(l.name), address: str(l.address) } }
  } else {
    // audioMessage → "audio", stickerMessage → "sticker", documentMessage → "document"…
    message = { ...base, type: messageType.replace(/Message$/, '').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase() || 'message' }
  }
  return { message, fromMe, profileName }
}

/** Reads one Evolution webhook delivery (one event per request). */
export function parseWebhook(payload: unknown): WebhookEvent {
  const p = payload as { event?: unknown; instance?: unknown; data?: unknown } | null
  const instance = typeof p?.instance === 'string' ? p.instance : null
  const event = typeof p?.event === 'string' ? p.event.toLowerCase().replace(/_/g, '.') : null
  const data = p?.data && typeof p.data === 'object' ? (p.data as Record<string, unknown>) : null
  if (!instance || !event || !data) return { kind: 'ignore' }

  if (event === 'messages.upsert') {
    const parsed = normalise(data)
    return parsed ? { kind: 'message', instance, ...parsed } : { kind: 'ignore' }
  }
  if (event === 'connection.update') {
    const state = data.state
    if (state !== 'open' && state !== 'connecting' && state !== 'close' && state !== 'refused') return { kind: 'ignore' }
    const phone = phoneFromJid(typeof data.wuid === 'string' ? data.wuid : undefined)
    return { kind: 'connection', instance, state, ...(phone ? { phone } : {}) }
  }
  if (event === 'qrcode.updated') {
    const qr = (data.qrcode as { base64?: unknown } | undefined)?.base64
    return { kind: 'qr', instance, qr: typeof qr === 'string' && qr.startsWith('data:image/') ? qr : null }
  }
  return { kind: 'ignore' }
}

/** The words in a message, whatever kind it is. Null for media we can't read. */
export function messageText(message: InboundWhatsAppMessage): string | null {
  return message.type === 'text' ? (message.text?.body ?? null) : null
}

/** What a message said, for the chat history. Media becomes a short label. */
export function describeMessage(message: InboundWhatsAppMessage): string {
  const text = messageText(message)
  if (text !== null && text.trim() !== '') return text
  const caption = message.image?.caption?.trim()
  if (message.type === 'image') return caption ? `[picture] ${caption}` : '[picture]'
  return `[${message.type.replace(/_/g, ' ')}]`
}
