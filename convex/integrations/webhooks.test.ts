import { afterEach, describe, expect, it, vi } from 'vitest'
import { WEBHOOK_SECRET as SECRET, b64urlJson, evolutionAuth, upsert as upsertFor } from '../../test/evolution'
import { hmacHex } from '../model/crypto'
import { describeMessage, messageText, parseWebhook, phoneFromJid, verifyWebhookAuth } from './evolution'
import { verifyWebhook } from './paystack'

afterEach(() => vi.unstubAllEnvs())

const body = JSON.stringify({ event: 'charge.success', data: { reference: 'STL-1001-1' } })
const NOW = 1_780_000_000
const token = (secret = SECRET, claims: Record<string, unknown> = {}) => evolutionAuth(secret, claims, NOW)
const upsert = (data: Record<string, unknown>) => upsertFor('stallo-abc', data)
const CUSTOMER_JID = '233241234567@s.whatsapp.net'

describe('Evolution webhook auth', () => {
  it('accepts a token signed with our secret', async () => {
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', SECRET)
    expect(await verifyWebhookAuth(await token(), NOW + 5)).toBe(true)
  })

  it('rejects a wrong signature, a missing header, junk and changed claims', async () => {
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', SECRET)
    expect(await verifyWebhookAuth(await token('some-other-secret-0123456789abcdefgh'), NOW)).toBe(false)
    expect(await verifyWebhookAuth(null, NOW)).toBe(false)
    expect(await verifyWebhookAuth('Bearer not.a.jwt', NOW)).toBe(false)
    const [head, , sig] = (await token()).slice('Bearer '.length).split('.')
    const forged = b64urlJson({ iat: NOW, exp: NOW + 99999, app: 'evolution', action: 'webhook' })
    expect(await verifyWebhookAuth(`Bearer ${head}.${forged}.${sig}`, NOW)).toBe(false)
    expect(await verifyWebhookAuth(await token(SECRET, { action: 'other' }), NOW)).toBe(false)
  })

  it('rejects an expired token', async () => {
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', SECRET)
    expect(await verifyWebhookAuth(await token(), NOW + 700)).toBe(false)
  })

  it('rejects everything when the secret is not configured, or too short', async () => {
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', '')
    expect(await verifyWebhookAuth(await token(), NOW)).toBe(false)
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', 'short')
    expect(await verifyWebhookAuth(await token('short'), NOW)).toBe(false)
  })
})

describe('Evolution webhook payload', () => {
  it('reads a customer text message', () => {
    const event = parseWebhook(
      upsert({
        key: { remoteJid: CUSTOMER_JID, fromMe: false, id: 'ABC1' },
        pushName: 'Kofi',
        messageType: 'conversation',
        message: { conversation: 'Abeg 2 jollof' },
        messageTimestamp: 1780000000,
      }),
    )
    expect(event).toMatchObject({ kind: 'message', instance: 'stallo-abc', fromMe: false, profileName: 'Kofi' })
    if (event.kind !== 'message') throw new Error('expected a message')
    expect(event.message).toMatchObject({ id: 'ABC1', from: '233241234567', jid: CUSTOMER_JID, type: 'text' })
    expect(messageText(event.message)).toBe('Abeg 2 jollof')
  })

  it('marks messages the seller typed on their own phone', () => {
    const event = parseWebhook(
      upsert({ key: { remoteJid: CUSTOMER_JID, fromMe: true, id: 'ME1' }, pushName: 'Você', messageType: 'conversation', message: { conversation: 'I will bring it' } }),
    )
    expect(event).toMatchObject({ kind: 'message', fromMe: true })
    if (event.kind === 'message') expect(event.profileName).toBeUndefined()
  })

  it('uses the phone number when WhatsApp hides it behind a @lid id, and skips the message when it can’t', () => {
    const withAlt = parseWebhook(upsert({ key: { remoteJid: '1234@lid', remoteJidAlt: CUSTOMER_JID, id: 'L1' }, messageType: 'conversation', message: { conversation: 'Hi' } }))
    expect(withAlt).toMatchObject({ kind: 'message', message: { from: '233241234567' } })
    expect(parseWebhook(upsert({ key: { remoteJid: '1234@lid', id: 'L2' }, messageType: 'conversation', message: { conversation: 'Hi' } }))).toEqual({ kind: 'ignore' })
  })

  it('reads pictures, locations and other media', () => {
    const image = parseWebhook(upsert({ key: { remoteJid: CUSTOMER_JID, id: 'I1' }, messageType: 'imageMessage', message: { imageMessage: { caption: 'This one?' } } }))
    if (image.kind !== 'message') throw new Error('expected a message')
    expect(image.message).toMatchObject({ type: 'image', image: { caption: 'This one?' } })
    expect(describeMessage(image.message)).toBe('[picture] This one?')

    const location = parseWebhook(
      upsert({ key: { remoteJid: CUSTOMER_JID, id: 'G1' }, messageType: 'locationMessage', message: { locationMessage: { degreesLatitude: 5.67, degreesLongitude: -0.17, name: 'Madina' } } }),
    )
    expect(location).toMatchObject({ kind: 'message', message: { type: 'location', location: { latitude: 5.67, longitude: -0.17, name: 'Madina' } } })

    const audio = parseWebhook(upsert({ key: { remoteJid: CUSTOMER_JID, id: 'A1' }, messageType: 'audioMessage', message: {} }))
    if (audio.kind !== 'message') throw new Error('expected a message')
    expect(audio.message.type).toBe('audio')
    expect(messageText(audio.message)).toBeNull()
    expect(describeMessage(audio.message)).toBe('[audio]')
  })

  it('ignores groups, status updates, reactions, edits, our own sends and junk', () => {
    const text = { messageType: 'conversation', message: { conversation: 'hi' } }
    expect(parseWebhook(upsert({ key: { remoteJid: '1203@g.us', id: 'X1' }, ...text }))).toEqual({ kind: 'ignore' })
    expect(parseWebhook(upsert({ key: { remoteJid: 'status@broadcast', id: 'X2' }, ...text }))).toEqual({ kind: 'ignore' })
    expect(parseWebhook(upsert({ key: { remoteJid: CUSTOMER_JID, id: 'X3' }, messageType: 'reactionMessage', message: {} }))).toEqual({ kind: 'ignore' })
    expect(parseWebhook(upsert({ key: { remoteJid: CUSTOMER_JID, id: 'X4' }, messageType: 'protocolMessage', message: {} }))).toEqual({ kind: 'ignore' })
    expect(parseWebhook({ event: 'send.message', instance: 'stallo-abc', data: { key: { id: 'X5' } } })).toEqual({ kind: 'ignore' })
    expect(parseWebhook(null)).toEqual({ kind: 'ignore' })
    expect(phoneFromJid('233241234567:12@s.whatsapp.net')).toBe('233241234567')
  })

  it('reads session state and QR codes', () => {
    expect(parseWebhook({ event: 'connection.update', instance: 'stallo-abc', data: { state: 'open', wuid: '233200000000@s.whatsapp.net' } })).toEqual({
      kind: 'connection',
      instance: 'stallo-abc',
      state: 'open',
      phone: '233200000000',
    })
    expect(parseWebhook({ event: 'CONNECTION_UPDATE', instance: 'stallo-abc', data: { state: 'close', statusReason: 401 } })).toEqual({
      kind: 'connection',
      instance: 'stallo-abc',
      state: 'close',
    })
    expect(parseWebhook({ event: 'qrcode.updated', instance: 'stallo-abc', data: { qrcode: { base64: 'data:image/png;base64,AAA' } } })).toEqual({
      kind: 'qr',
      instance: 'stallo-abc',
      qr: 'data:image/png;base64,AAA',
    })
    expect(parseWebhook({ event: 'qrcode.updated', instance: 'stallo-abc', data: { message: 'QR code limit reached' } })).toEqual({
      kind: 'qr',
      instance: 'stallo-abc',
      qr: null,
    })
  })
})

describe('Paystack webhook signature', () => {
  it('checks x-paystack-signature with the secret key', async () => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_x')
    vi.stubEnv('PAYSTACK_WEBHOOK_SECRET', '')
    const good = await hmacHex('SHA-512', 'sk_test_x', body)
    const bad = (good.endsWith('0') ? good.slice(0, -1) + '1' : good.slice(0, -1) + '0')
    expect(await verifyWebhook(body, { signature: null, legacySignature: good })).toBe(true)
    expect(await verifyWebhook(body, { signature: null, legacySignature: bad })).toBe(false)
  })

  it('checks the newer Paystack-Signature header, with a 5-minute window', async () => {
    vi.stubEnv('PAYSTACK_WEBHOOK_SECRET', 'whsec_abc')
    const t = 1_760_270_400
    const sig = await hmacHex('SHA-512', 'whsec_abc', `${t}.${body}`)
    const header = `t=${t},v1=whk_old:${'0'.repeat(128)},v1=whk_new:${sig}`
    expect(await verifyWebhook(body, { signature: header, legacySignature: null }, t + 10)).toBe(true)
    expect(await verifyWebhook(body, { signature: header, legacySignature: null }, t + 301)).toBe(false)
    // Once a signing secret is set, the older header alone is not enough.
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_x')
    const legacy = await hmacHex('SHA-512', 'sk_test_x', body)
    expect(await verifyWebhook(body, { signature: null, legacySignature: legacy }, t)).toBe(false)
  })

  it('rejects everything when no secret is configured', async () => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', '')
    vi.stubEnv('PAYSTACK_WEBHOOK_SECRET', '')
    expect(await verifyWebhook(body, { signature: null, legacySignature: await hmacHex('SHA-512', 'x', body) })).toBe(false)
  })
})
