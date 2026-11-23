import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { claudeAnswer, mockFetch, seller, setup, type T } from '../test/convexTest'
import { WEBHOOK_SECRET, evolutionAuth, textUpsert } from '../test/evolution'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { HOURLY_LIMIT_NEW, typingMs } from './outbound'

/**
 * The safety rules around the seller's linked WhatsApp (ADR 0002): inbound only,
 * human takeover, seen → typing → send, hourly limits, and the QR session guard.
 */

const INSTANCE = 'stallo-rules01'
const EVOLUTION = 'evolution.test'
const CUSTOMER_WA = '233201112222'
const CUSTOMER = '+233201112222'
const HOUR = 60 * 60 * 1000

const settle = (t: T) => t.finishAllScheduledFunctions(vi.runAllTimers)

async function webhook(t: T, payload: unknown) {
  return t.fetch('/evolution/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: await evolutionAuth() },
    body: JSON.stringify(payload),
  })
}

function fakes(extra: Parameters<typeof mockFetch>[0] = {}) {
  let n = 0
  return mockFetch({
    [`${EVOLUTION}/message/sendText/`]: () => ({ key: { id: `OUT${++n}`, fromMe: true } }),
    [`${EVOLUTION}/chat/markMessageAsRead/`]: () => ({ read: 'success' }),
    'sms.sasusync.com/api/v1/send': () => ({ success: true }),
    'api.anthropic.com/v1/messages': () =>
      claudeAnswer({ intent: 'greeting', items: null, address: null, customer_name: null, recipient_name: null, recipient_phone: null, outside_delivery_area: null, pay_with: null, unmatched: [], reply: null, confidence: 0.95 }),
    ...extra,
  })
}

/** A seller whose phone was linked `linkedAgo` ms ago. */
async function linkedSeller(t: T, linkedAgo = 30 * 24 * HOUR) {
  const as = await seller(t, '+233241234567', 'Ama’s Kitchen')
  const sellerId = (await as.query(api.sellers.mine, {}))!._id
  await t.run(async (ctx) => {
    await ctx.db.patch(sellerId, { whatsappInstance: INSTANCE, whatsappConnectedAt: Date.now() - linkedAgo })
    await ctx.db.insert('whatsappSessions', { sellerId, instance: INSTANCE, state: 'open', startedAt: Date.now() })
  })
  return { as, sellerId }
}

/** The customer wrote to the seller (opens the inbound-only rule for them). */
function customerWrote(t: T, sellerId: Id<'sellers'>, from = CUSTOMER, id = `IN${Math.random()}`) {
  return t.run((ctx) =>
    ctx.db.insert('inboundMessages', {
      whatsappMessageId: id,
      sellerId,
      instance: INSTANCE,
      from,
      raw: { id, from: from.slice(1), jid: `${from.slice(1)}@s.whatsapp.net`, type: 'text', text: { body: 'Hi' } },
      status: 'done',
      attempts: 1,
      receivedAt: Date.now(),
    }),
  )
}

function queue(t: T, sellerId: Id<'sellers'>, text: string, extra: { smsFallback?: boolean; to?: string } = {}) {
  return t.run((ctx) =>
    ctx.db.insert('outboundMessages', {
      sellerId,
      channel: 'seller',
      recipient: extra.to ?? CUSTOMER,
      text,
      ...(extra.smsFallback ? { smsFallback: true } : {}),
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    }),
  )
}

const message = (t: T, id: Id<'outboundMessages'>) => t.run(async (ctx) => (await ctx.db.get(id))!)

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('EVOLUTION_API_URL', `https://${EVOLUTION}`)
  vi.stubEnv('EVOLUTION_API_KEY', 'evolution-key')
  vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', WEBHOOK_SECRET)
  vi.stubEnv('CONVEX_SITE_URL', 'https://stallo-test.convex.site')
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('seen, typing, send', () => {
  it('marks the customer’s message read, then sends with a short typing pause', async () => {
    const t = setup()
    const calls = fakes()
    await linkedSeller(t)
    await webhook(t, textUpsert(INSTANCE, CUSTOMER_WA, 'Hello', 'HELLO1'))
    await settle(t)

    const evolution = calls.filter((c) => c.url.includes(EVOLUTION))
    const read = evolution.findIndex((c) => c.url.includes('/chat/markMessageAsRead/'))
    const send = evolution.findIndex((c) => c.url.includes('/message/sendText/'))
    expect(read).toBeGreaterThanOrEqual(0)
    expect(send).toBeGreaterThan(read)
    expect(evolution[read].body).toEqual({ readMessages: [{ remoteJid: `${CUSTOMER_WA}@s.whatsapp.net`, fromMe: false, id: 'HELLO1' }] })
    const body = evolution[send].body as { number: string; text: string; delay: number }
    expect(body.number).toBe(CUSTOMER_WA)
    expect(body.delay).toBeGreaterThanOrEqual(1200)
    expect(body.delay).toBeLessThanOrEqual(4300)
  })

  it('keeps the typing pause between 1.2 and 4.3 seconds whatever the length', () => {
    for (const text of ['ok', 'x'.repeat(100), 'x'.repeat(5000)]) {
      for (const r of [0, 0.5, 1]) {
        const ms = typingMs(text, r)
        expect(ms).toBeGreaterThanOrEqual(1200)
        expect(ms).toBeLessThanOrEqual(4300)
      }
    }
    expect(typingMs('x'.repeat(200), 0.5)).toBeGreaterThan(typingMs('ok', 0.5))
  })
})

describe('inbound only', () => {
  it('never starts a WhatsApp chat: without an SMS fallback the seller is told instead', async () => {
    const t = setup()
    const calls = fakes()
    const { sellerId } = await linkedSeller(t)
    const id = await queue(t, sellerId, 'Hello from Stallo')
    await t.action(internal.outbound.send, { id })
    await settle(t)
    expect(await message(t, id)).toMatchObject({ status: 'failed' })
    expect(calls.some((c) => c.url.includes('/message/sendText/'))).toBe(false)
    const items = await t.run((ctx) => ctx.db.query('attentionItems').collect())
    expect(items.some((i) => i.type === 'message_failed')).toBe(true)
  })

  it('sends messages that must arrive (delivery code) by SMS when the customer hasn’t written recently', async () => {
    const t = setup()
    vi.stubEnv('SMS_TEST_MODE', 'true')
    const calls = fakes()
    const { sellerId } = await linkedSeller(t)
    await customerWrote(t, sellerId)
    vi.advanceTimersByTime(25 * HOUR)
    const id = await queue(t, sellerId, 'Your delivery code is 1234.', { smsFallback: true })
    await t.action(internal.outbound.send, { id })
    await settle(t)
    expect(await message(t, id)).toMatchObject({ status: 'done', via: 'sms' })
    expect(calls.some((c) => c.url.includes('/message/sendText/'))).toBe(false)
  })

  it('replies on WhatsApp within 24 hours of the customer’s message', async () => {
    const t = setup()
    fakes()
    const { sellerId } = await linkedSeller(t)
    await customerWrote(t, sellerId)
    vi.advanceTimersByTime(23 * HOUR)
    const id = await queue(t, sellerId, 'Your order is on the way.', { smsFallback: true })
    await t.action(internal.outbound.send, { id })
    await settle(t)
    expect(await message(t, id)).toMatchObject({ status: 'done', via: 'whatsapp', whatsappMessageId: expect.stringMatching(/^OUT/) })
  })
})

describe('hourly limit', () => {
  it('holds messages over 25 an hour for a newly linked phone, then sends them', async () => {
    const t = setup()
    const calls = fakes()
    const { sellerId } = await linkedSeller(t, 2 * 24 * HOUR)
    await customerWrote(t, sellerId)
    await t.run(async (ctx) => {
      for (let i = 0; i < HOURLY_LIMIT_NEW; i++) {
        await ctx.db.insert('outboundMessages', {
          sellerId,
          channel: 'seller',
          recipient: `+23320000${String(i).padStart(4, '0')}`,
          text: 'earlier',
          status: 'done',
          via: 'whatsapp',
          sentAt: Date.now() - 10 * 60 * 1000,
          createdAt: Date.now() - 10 * 60 * 1000,
        })
      }
    })
    const id = await queue(t, sellerId, 'One more')
    await t.action(internal.outbound.send, { id })
    const held = await message(t, id)
    expect(held.status).toBe('pending')
    expect(held.notBefore).toBeGreaterThan(Date.now() + 49 * 60 * 1000)
    expect(calls.some((c) => c.url.includes('/message/sendText/'))).toBe(false)

    await settle(t) // the held message goes once the hour has passed
    expect(await message(t, id)).toMatchObject({ status: 'done', via: 'whatsapp' })
  })

  it('allows 60 an hour once the link is a week old', async () => {
    const t = setup()
    fakes()
    const { sellerId } = await linkedSeller(t, 8 * 24 * HOUR)
    await customerWrote(t, sellerId)
    await t.run(async (ctx) => {
      for (let i = 0; i < 40; i++) {
        await ctx.db.insert('outboundMessages', { sellerId, channel: 'seller', recipient: '+233200000000', text: 'x', status: 'done', sentAt: Date.now() - 60_000, createdAt: Date.now() })
      }
    })
    const id = await queue(t, sellerId, 'Still fine')
    await t.action(internal.outbound.send, { id })
    await settle(t)
    expect((await message(t, id)).status).toBe('done')
  })
})

describe('one chat at a time', () => {
  it('sends messages to the same person in the order they were queued', async () => {
    const t = setup()
    const calls = fakes()
    const { sellerId } = await linkedSeller(t)
    await customerWrote(t, sellerId)
    const first = await queue(t, sellerId, 'First')
    const second = await queue(t, sellerId, 'Second')
    await t.action(internal.outbound.send, { id: second }) // the later one is tried first
    expect((await message(t, second)).status).toBe('pending')
    await t.action(internal.outbound.send, { id: first })
    await settle(t)
    const texts = calls.filter((c) => c.url.includes('/message/sendText/')).map((c) => (c.body as { text: string }).text)
    expect(texts).toEqual(['First', 'Second'])
  })
})

describe('human takeover', () => {
  it('doesn’t mistake Stallo’s own messages for the seller replying', async () => {
    const t = setup()
    fakes()
    const { sellerId } = await linkedSeller(t)
    await customerWrote(t, sellerId)
    const id = await queue(t, sellerId, 'Thanks, noted')
    await t.action(internal.outbound.send, { id })
    await settle(t)
    const sentId = (await message(t, id)).whatsappMessageId!
    await webhook(t, textUpsert(INSTANCE, CUSTOMER_WA, 'Thanks, noted', sentId, true))
    const conversation = await t.run((ctx) => ctx.db.query('conversations').first())
    expect(conversation?.sellerActiveUntil).toBeUndefined()

    await webhook(t, textUpsert(INSTANCE, CUSTOMER_WA, 'I will call you', 'TYPED1', true))
    const after = await t.run(async (ctx) => (await ctx.db.query('conversations').first())!)
    expect(after.sellerActiveUntil).toBeGreaterThan(Date.now() + 2.9 * HOUR)
  })
})

describe('linking WhatsApp by QR code', () => {
  function linkFakes() {
    return fakes({
      [`${EVOLUTION}/instance/create`]: () => ({ instance: { instanceName: 'x', status: 'connecting' }, qrcode: { base64: 'data:image/png;base64,QR1' } }),
      [`${EVOLUTION}/webhook/set/`]: () => ({}),
      [`${EVOLUTION}/instance/connectionState/`]: () => ({ instance: { state: 'close' } }),
      [`${EVOLUTION}/instance/connect/`]: () => ({ base64: 'data:image/png;base64,QR2', code: 'x', count: 2 }),
      [`${EVOLUTION}/instance/logout/`]: () => ({ status: 'SUCCESS' }),
      [`${EVOLUTION}/instance/delete/`]: () => ({ status: 'SUCCESS' }),
    })
  }

  it('shows a QR code, refuses a new one while it’s fresh, and links when the phone scans it', async () => {
    const t = setup()
    const calls = linkFakes()
    const as = await seller(t, '+233241234567', 'Ama’s Kitchen')
    await as.action(api.whatsappConnect.start, {})

    const create = calls.find((c) => c.url.includes('/instance/create'))!
    const body = create.body as { instanceName: string; integration: string; webhook: { url: string; headers: Record<string, string>; events: string[] } }
    expect(body.integration).toBe('WHATSAPP-BAILEYS')
    expect(body.webhook.url).toBe('https://stallo-test.convex.site/evolution/webhook')
    expect(body.webhook.headers).toEqual({ jwt_key: WEBHOOK_SECRET })
    expect(body.webhook.events).toEqual(['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'])
    expect(await as.query(api.whatsappConnect.status, {})).toMatchObject({ state: 'connecting', qr: 'data:image/png;base64,QR1' })

    // Session guard: no restart while the code is fresh.
    await expect(as.action(api.whatsappConnect.start, {})).rejects.toThrow(/wait a minute/)
    expect(calls.filter((c) => c.url.includes('/instance/')).length).toBe(1)

    // Evolution sends a fresh code, then the phone scans it.
    const instance = body.instanceName
    await webhook(t, { event: 'qrcode.updated', instance, data: { qrcode: { base64: 'data:image/png;base64,QR3' } } })
    expect((await as.query(api.whatsappConnect.status, {})).qr).toBe('data:image/png;base64,QR3')
    await webhook(t, { event: 'connection.update', instance, data: { state: 'open', wuid: '233241234567@s.whatsapp.net' } })
    expect(await as.query(api.whatsappConnect.status, {})).toMatchObject({ state: 'open', qr: null, phone: '+233241234567' })
    expect((await as.query(api.sellers.mine, {}))!.whatsappConnected).toBe(true)
  })

  it('reuses the session after the cooldown, and tells the seller when the phone unlinks', async () => {
    const t = setup()
    vi.stubEnv('SMS_TEST_MODE', 'true')
    const calls = linkFakes()
    const as = await seller(t, '+233241234567', 'Ama’s Kitchen')
    await as.action(api.whatsappConnect.start, {})
    const instance = (calls.find((c) => c.url.includes('/instance/create'))!.body as { instanceName: string }).instanceName

    vi.advanceTimersByTime(61 * 1000)
    await as.action(api.whatsappConnect.start, {})
    expect(calls.filter((c) => c.url.includes('/instance/create'))).toHaveLength(1)
    expect(calls.some((c) => c.url.includes(`/instance/connect/${instance}`))).toBe(true)

    await webhook(t, { event: 'connection.update', instance, data: { state: 'open', wuid: '233241234567@s.whatsapp.net' } })
    await webhook(t, { event: 'connection.update', instance, data: { state: 'close', statusReason: 401 } })
    await settle(t)
    expect((await as.query(api.sellers.mine, {}))!.whatsappConnected).toBe(false)
    const items = await t.run((ctx) => ctx.db.query('attentionItems').collect())
    expect(items.map((i) => i.type)).toContain('whatsapp_disconnected')
    const alerts = await t.run((ctx) => ctx.db.query('outboundMessages').collect())
    expect(alerts).toEqual([expect.objectContaining({ recipient: '+233241234567', via: 'sms', status: 'done' })])
  })

  it('won’t link a number that another business already uses', async () => {
    const t = setup()
    const calls = linkFakes()
    const { sellerId: other } = await linkedSeller(t)
    await t.run((ctx) => ctx.db.patch(other, { whatsappDisplayPhone: '+233209998888' }))
    const as = await seller(t, '+233551234567', 'Kwame Shop')
    await as.action(api.whatsappConnect.start, {})
    const instance = (calls.find((c) => c.url.includes('/instance/create'))!.body as { instanceName: string }).instanceName
    await webhook(t, { event: 'connection.update', instance, data: { state: 'open', wuid: '233209998888@s.whatsapp.net' } })
    await settle(t)
    expect(await as.query(api.whatsappConnect.status, {})).toMatchObject({ state: 'close', error: expect.stringMatching(/another business/) })
    expect(calls.some((c) => c.url.includes(`/instance/logout/${instance}`))).toBe(true)
  })

  it('unlinks on request', async () => {
    const t = setup()
    const calls = linkFakes()
    const { as } = await linkedSeller(t)
    await as.action(api.whatsappConnect.disconnect, {})
    expect(calls.some((c) => c.url.includes(`/instance/delete/${INSTANCE}`))).toBe(true)
    expect(await as.query(api.whatsappConnect.status, {})).toMatchObject({ state: 'none' })
  })

  it('says linking isn’t available until Evolution is configured', async () => {
    const t = setup()
    vi.stubEnv('EVOLUTION_API_URL', '')
    const as = await seller(t, '+233241234567', 'Ama’s Kitchen')
    expect((await as.query(api.whatsappConnect.status, {})).available).toBe(false)
    await expect(as.action(api.whatsappConnect.start, {})).rejects.toThrow(/isn’t set up/)
  })
})
