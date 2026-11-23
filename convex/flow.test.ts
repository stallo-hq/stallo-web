import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { claudeAnswer, mockFetch, seller, setup, type T } from '../test/convexTest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { WEBHOOK_SECRET, evolutionAuth, textUpsert, upsert } from '../test/evolution'
import type { Extraction } from './integrations/assistant'
import { hmacHex } from './model/crypto'

/**
 * End to end through the real webhooks, scheduler and integrations, with
 * Evolution (WhatsApp), Claude, SasuSync and Paystack replaced by a fake fetch.
 */

const INSTANCE = 'stallo-test0001'
const EVOLUTION = 'evolution.test'
const CUSTOMER_WA = '233201112222'
const CUSTOMER = '+233201112222'
const RIDER = '+233271234567'

function answer(partial: Partial<Extraction>): Extraction {
  return { intent: 'order', items: null, address: null, customer_name: null, recipient_name: null, recipient_phone: null, outside_delivery_area: null, pay_with: null, unmatched: [], reply: null, confidence: 0.95, ...partial }
}

let messageCounter = 0
async function evolutionWebhook(t: T, payload: unknown, secret = WEBHOOK_SECRET) {
  return t.fetch('/evolution/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: await evolutionAuth(secret) },
    body: JSON.stringify(payload),
  })
}

async function whatsappWebhook(t: T, text: string, from = CUSTOMER_WA, opts: { id?: string; secret?: string } = {}) {
  return evolutionWebhook(t, textUpsert(INSTANCE, from, text, opts.id ?? `IN${++messageCounter}`), opts.secret)
}

/** The seller typed a message to a customer on their own phone (fromMe, not sent by Stallo). */
async function sellerEcho(t: T, text: string, to = CUSTOMER_WA, id = `ME${++messageCounter}`) {
  return evolutionWebhook(t, textUpsert(INSTANCE, to, text, id, true))
}

async function paystackWebhook(t: T, event: string, data: Record<string, unknown>) {
  const body = JSON.stringify({ event, data })
  return t.fetch('/paystack/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-paystack-signature': await hmacHex('SHA-512', 'sk_test_flow', body) },
    body,
  })
}

const settle = (t: T) => t.finishAllScheduledFunctions(vi.runAllTimers)

/** A seller with WhatsApp and payouts connected, one product, and fakes for every outside service. */
async function world() {
  const t = setup()
  const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
  const sellerId = (await ama.query(api.sellers.mine, {}))!._id
  const productId = await t.run(async (ctx) => {
    // Linked a month ago, so the 60-an-hour limit applies.
    await ctx.db.patch(sellerId, { whatsappInstance: INSTANCE, whatsappConnectedAt: Date.now() - 30 * 24 * 3600_000, paystackSubaccountCode: 'ACCT_test' })
    await ctx.db.insert('whatsappSessions', { sellerId, instance: INSTANCE, state: 'open', startedAt: Date.now() })
    return ctx.db.insert('products', { sellerId, name: 'Jollof with chicken', pricePesewas: 6500, stock: 5, active: true })
  })

  const answers: unknown[] = []
  const paystack = { amount: 0 }
  const calls = mockFetch({
    [`${EVOLUTION}/message/sendText/`]: () => ({ key: { id: `OUT${Math.random().toString(16).slice(2)}`, fromMe: true }, status: 'PENDING' }),
    [`${EVOLUTION}/chat/markMessageAsRead/`]: () => ({ message: 'Read messages', read: 'success' }),
    [`${EVOLUTION}/chat/getBase64FromMediaMessage/`]: () => ({ mediaType: 'imageMessage', mimetype: 'image/jpeg', base64: '/9j/2Q==' }),
    'api.anthropic.com/v1/messages': () => claudeAnswer(answers.shift() ?? answer({ intent: 'other', confidence: 0.2 })),
    'sms.sasusync.com/api/v1/send': () => ({ success: true, data: { status: 'queued' } }),
    'api.paystack.co/transaction/initialize': (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { reference: string; amount: string }
      paystack.amount = Number(body.amount)
      return { status: true, data: { authorization_url: 'https://checkout.paystack.com/test', reference: body.reference } }
    },
    'api.paystack.co/transaction/verify/': (url) => ({
      status: true,
      data: { status: 'success', amount: paystack.amount, currency: 'GHS', reference: decodeURIComponent(url.pathname.split('/').pop()!) },
    }),
  })

  const order = () => t.run(async (ctx) => (await ctx.db.query('orders').first())!)
  const sent = () => t.run((ctx) => ctx.db.query('outboundMessages').collect())
  return { t, ama, sellerId, productId, answers, calls, order, sent }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('EVOLUTION_API_URL', `https://${EVOLUTION}`)
  vi.stubEnv('EVOLUTION_API_KEY', 'evolution-key')
  vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', WEBHOOK_SECRET)
  vi.stubEnv('CONVEX_SITE_URL', 'https://stallo-test.convex.site')
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_flow')
  vi.stubEnv('PAYSTACK_WEBHOOK_SECRET', '')
  vi.stubEnv('PLATFORM_FEE_PERCENT', '2')
  vi.stubEnv('PLATFORM_FEE_FLAT_PESEWAS', '0')
  vi.stubEnv('SITE_URL', 'https://stallo.test')
})

/** Real SMS sending (to the fake SasuSync) after the seller has signed up in test mode. */
function realSms(apiKey = 'sms-key') {
  vi.stubEnv('SMS_TEST_MODE', '')
  vi.stubEnv('SASUSYNC_API_KEY', apiKey)
  vi.stubEnv('SASUSYNC_SENDER_ID', 'Stallo')
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('WhatsApp webhook (Evolution)', () => {
  it('rejects a token signed with the wrong secret, or none, and stores nothing', async () => {
    const { t } = await world()
    expect((await whatsappWebhook(t, 'Hi', CUSTOMER_WA, { secret: 'not-the-secret-0123456789abcdefghij' })).status).toBe(401)
    const unsigned = await t.fetch('/evolution/webhook', { method: 'POST', body: JSON.stringify(textUpsert(INSTANCE, CUSTOMER_WA, 'Hi', 'X1')) })
    expect(unsigned.status).toBe(401)
    expect(await t.run((ctx) => ctx.db.query('inboundMessages').collect())).toEqual([])
  })

  it('rejects everything when the webhook secret is not set', async () => {
    const { t } = await world()
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', '')
    expect((await whatsappWebhook(t, 'Hi')).status).toBe(401)
  })

  it('ignores messages for a session Stallo doesn’t know', async () => {
    const { t } = await world()
    expect((await evolutionWebhook(t, textUpsert('stallo-unknown', CUSTOMER_WA, 'Hi', 'U1'))).status).toBe(200)
    expect(await t.run((ctx) => ctx.db.query('inboundMessages').collect())).toEqual([])
  })

  it('handles retries of the same message once', async () => {
    const { t, answers, sent } = await world()
    answers.push(answer({ intent: 'greeting' }), answer({ intent: 'greeting' }))
    expect((await whatsappWebhook(t, 'Hello', CUSTOMER_WA, { id: 'SAME' })).status).toBe(200)
    expect((await whatsappWebhook(t, 'Hello', CUSTOMER_WA, { id: 'SAME' })).status).toBe(200)
    await settle(t)
    expect(await t.run((ctx) => ctx.db.query('inboundMessages').collect())).toHaveLength(1)
    const replies = (await sent()).filter((m) => m.recipient === CUSTOMER)
    expect(replies.length).toBeGreaterThan(0)
    expect(replies.map((m) => [m.status, m.error])).toEqual(replies.map(() => ['done', undefined]))
    expect(answers).toHaveLength(1) // Claude was asked once
  })
})

describe('order to delivery', () => {
  it('turns a chat into a paid, delivered order', async () => {
    const { t, ama, productId, answers, order, sent } = await world()

    // 1. Customer orders in Pidgin; Stallo asks them to confirm.
    answers.push(answer({ items: [{ product_id: productId, quantity: 2 }], address: 'Madina, near the zongo junction' }))
    await whatsappWebhook(t, 'Abeg 2 jollof, bring am Madina zongo junction')
    await settle(t)
    let o = await order()
    expect(o).toMatchObject({ status: 'awaiting_confirmation', subtotalPesewas: 13000, address: 'Madina, near the zongo junction' })
    expect(o.items[0]).toMatchObject({ productId, unitPricePesewas: 6500, qty: 2 }) // price from the product list

    // 2. Customer confirms; the payment link goes out with Stallo's fee split off.
    answers.push(answer({ intent: 'confirm' }))
    await whatsappWebhook(t, 'Yes')
    await settle(t)
    o = await order()
    expect(o).toMatchObject({ status: 'awaiting_payment', paymentStatus: 'pending', feePesewas: 260, totalPesewas: 13000 })
    expect((await sent()).some((m) => m.recipient === CUSTOMER && m.text?.includes('https://checkout.paystack.com/test'))).toBe(true)
    const payment = await t.run(async (ctx) => (await ctx.db.query('payments').first())!)
    expect(payment).toMatchObject({ amountPesewas: 13000, status: 'pending' })

    // 3. Paystack says it's paid (twice, as webhooks can repeat). Stock goes down once.
    expect((await paystackWebhook(t, 'charge.success', { reference: payment.reference })).status).toBe(200)
    await settle(t)
    await paystackWebhook(t, 'charge.success', { reference: payment.reference })
    await settle(t)
    o = await order()
    expect(o).toMatchObject({ status: 'paid', paymentStatus: 'paid' })
    expect((await t.run((ctx) => ctx.db.get(productId)))!.stock).toBe(3)

    // 4. Seller dispatches. Customer gets the code; rider gets the link.
    await ama.action(api.deliveries.dispatch, { orderId: o._id, riderName: 'Yaw', riderPhone: '027 123 4567' })
    await settle(t)
    const messages = await sent()
    const pin = /delivery code is (\d{4})/.exec(messages.find((m) => m.recipient === CUSTOMER && m.text?.includes('delivery code'))!.text!)![1]
    const token = /\/r\/([0-9a-f]{64})/.exec(messages.find((m) => m.recipient === RIDER)!.text!)![1]
    expect((await order()).status).toBe('dispatched')
    expect(await t.run(async (ctx) => (await ctx.db.query('deliveries').first())!.pinHash)).not.toContain(pin)

    const job = await t.query(api.deliveries.riderJob, { token })
    expect(job).toMatchObject({ status: 'dispatched', customerPhone: CUSTOMER })

    // 5. Wrong code, then the right one.
    const wrong = pin === '0000' ? '1111' : '0000'
    expect(await t.mutation(api.deliveries.riderConfirm, { token, pin: wrong })).toMatchObject({ ok: false, attemptsLeft: 4 })
    expect(await t.mutation(api.deliveries.riderConfirm, { token, pin })).toMatchObject({ ok: true })
    await settle(t)
    expect((await order()).status).toBe('delivered')
    expect((await sent()).some((m) => m.recipient === CUSTOMER && m.text?.includes('has been delivered'))).toBe(true)

    // The link stops showing the customer's details once it's done.
    expect(await t.query(api.deliveries.riderJob, { token })).toMatchObject({ status: 'delivered' })
  })

  it('accepts the code sent by the rider on WhatsApp', async () => {
    const { t, ama, productId, order, sent } = await world()
    const orderId = await paidOrder(t, productId)
    await ama.action(api.deliveries.dispatch, { orderId, riderName: 'Yaw', riderPhone: '0271234567' })
    await settle(t)
    const pin = /delivery code is (\d{4})/.exec((await sent()).find((m) => m.text?.includes('delivery code'))!.text!)![1]
    await whatsappWebhook(t, pin, RIDER.slice(1))
    await settle(t)
    expect((await order()).status).toBe('delivered')
  })

  it('handles a failed delivery and a return, putting stock back', async () => {
    const { t, ama, productId, order } = await world()
    const orderId = await paidOrder(t, productId)
    await ama.action(api.deliveries.dispatch, { orderId, riderName: 'Yaw', riderPhone: '0271234567' })
    await settle(t)
    await ama.mutation(api.deliveries.markFailed, { orderId, reason: 'Customer not answering' })
    expect((await order()).status).toBe('delivery_failed')
    await ama.mutation(api.deliveries.markReturned, { orderId })
    expect((await order()).status).toBe('returned')
    expect((await t.run((ctx) => ctx.db.get(productId)))!.stock).toBe(5)
  })
})

describe('needs attention', () => {
  it('does not guess when the assistant is unsure', async () => {
    const { t, ama, productId, answers, sent } = await world()
    answers.push(answer({ items: [{ product_id: productId, quantity: 1 }], confidence: 0.4 }))
    await whatsappWebhook(t, 'that thing from last time')
    await settle(t)
    expect(await t.run((ctx) => ctx.db.query('orders').collect())).toEqual([])
    const overview = await ama.query(api.dashboard.today, {})
    expect(overview?.attention.some((a) => a.type === 'low_confidence')).toBe(true)
    expect((await sent()).some((m) => m.recipient === CUSTOMER)).toBe(true) // holding reply
  })
})

describe('seller replies from their phone', () => {
  const conversation = (t: T) => t.run(async (ctx) => (await ctx.db.query('conversations').first())!)

  it('stays quiet in that chat while the seller is replying, then answers again', async () => {
    const { t, answers, calls, sent } = await world()
    const assistantCalls = () => calls.filter((c) => c.url.includes('api.anthropic.com')).length
    expect((await sellerEcho(t, 'Hi Kofi, what would you like?', CUSTOMER_WA, 'ECHO_SAME')).status).toBe(200)
    await sellerEcho(t, 'Hi Kofi, what would you like?', CUSTOMER_WA, 'ECHO_SAME') // a webhook retry
    await whatsappWebhook(t, 'Two jollof please')
    await settle(t)

    expect(await sent()).toEqual([]) // no reply on top of the seller's
    expect(assistantCalls()).toBe(0) // and the assistant isn't asked
    const quiet = await conversation(t)
    expect(quiet.history?.map((h) => [h.from, h.text])).toEqual([
      ['seller', 'Hi Kofi, what would you like?'],
      ['customer', 'Two jollof please'],
    ])
    expect(quiet.lastInboundAt).toBeGreaterThan(0) // the customer's message opens the 24-hour window
    expect(await t.run((ctx) => ctx.db.query('inboundMessages').collect())).toEqual([
      expect.objectContaining({ status: 'done' }),
    ])

    // Still quiet after 2 hours.
    vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    await whatsappWebhook(t, 'Are you there?')
    await settle(t)
    expect(await sent()).toEqual([])

    // 3 hours after the seller's last reply, Stallo answers again.
    vi.advanceTimersByTime(61 * 60 * 1000)
    answers.push(answer({ intent: 'greeting' }))
    await whatsappWebhook(t, 'Hello?')
    await settle(t)
    expect(answers).toHaveLength(0)
    expect((await sent()).some((m) => m.recipient === CUSTOMER)).toBe(true)
  })

  it('does not open the 24-hour window when the seller starts the chat', async () => {
    const { t } = await world()
    await sellerEcho(t, 'Your order is ready')
    expect((await conversation(t)).lastInboundAt).toBe(0)
  })

  it('lets the seller hand the chat back to Stallo straight away', async () => {
    const { t, ama, productId, answers, sent, order } = await world()
    answers.push(answer({ items: [{ product_id: productId, quantity: 1 }], address: 'Osu, Oxford Street' }))
    await whatsappWebhook(t, 'One jollof to Osu, Oxford Street')
    await settle(t)
    const orderId = (await order())._id
    await sellerEcho(t, 'Give me a minute')
    expect((await ama.query(api.orders.get, { orderId }))?.sellerHandlingUntil).toBeGreaterThan(Date.now())

    const kwame = await seller(t, '+233551234567', 'Kwame Shop')
    await expect(kwame.mutation(api.conversations.letStalloReply, { orderId })).rejects.toThrow()

    await ama.mutation(api.conversations.letStalloReply, { orderId })
    expect((await ama.query(api.orders.get, { orderId }))?.sellerHandlingUntil).toBeUndefined()
    const before = (await sent()).length
    answers.push(answer({ intent: 'question', reply: 'We open at 8.' }))
    await whatsappWebhook(t, 'When do you open?')
    await settle(t)
    expect((await sent()).length).toBeGreaterThan(before)
  })

  it('tells the assistant what the seller said', async () => {
    const { t, answers, calls } = await world()
    await sellerEcho(t, 'Delivery is free today')
    vi.advanceTimersByTime(3 * 60 * 60 * 1000 + 60_000)
    answers.push(answer({ intent: 'greeting' }))
    await whatsappWebhook(t, 'Hi')
    await settle(t)
    const prompt = JSON.stringify(calls.filter((c) => c.url.includes('anthropic')).map((c) => c.body))
    expect(prompt).toContain('Business owner (typed by hand): Delivery is free today')
  })
})

describe('seller isolation', () => {
  it('never lets one seller see or dispatch another seller’s order', async () => {
    const { t, productId } = await world()
    const orderId = await paidOrder(t, productId)
    const kofi = await seller(t, '+233551234567', 'Kofi Foods')
    await expect(kofi.query(api.orders.get, { orderId })).resolves.toBeNull()
    await expect(kofi.action(api.deliveries.dispatch, { orderId, riderName: 'Yaw', riderPhone: '0271234567' })).rejects.toThrow()
    await expect(kofi.mutation(api.deliveries.markFailed, { orderId, reason: 'x' })).rejects.toThrow()
  })
})

/** Puts a paid order for 2 × the product straight into the database. */
async function paidOrder(t: T, productId: Id<'products'>, extra: { recipientName?: string; recipientPhone?: string } = {}) {
  return t.run(async (ctx) => {
    const product = (await ctx.db.get(productId))!
    await ctx.db.patch(productId, { stock: product.stock - 2 }) // as payment would
    const customerId = await ctx.db.insert('customers', { sellerId: product.sellerId, phone: CUSTOMER })
    return ctx.db.insert('orders', {
      sellerId: product.sellerId,
      customerId,
      number: 1001,
      items: [{ productId, name: product.name, unitPricePesewas: 6500, qty: 2 }],
      subtotalPesewas: 13000,
      feePesewas: 260,
      totalPesewas: 13000,
      address: 'Madina',
      ...extra,
      status: 'paid',
      paymentStatus: 'paid',
      timeline: [],
      createdAt: Date.now(),
    })
  })
}

describe('asking for the address', () => {
  it('takes a short reply as the address even when the assistant is unsure', async () => {
    const { t, productId, answers, order } = await world()
    answers.push(answer({ items: [{ product_id: productId, quantity: 1 }] }))
    await whatsappWebhook(t, 'Jollof')
    await settle(t)
    expect((await order()).status).toBe('draft')

    answers.push(answer({ intent: 'other', confidence: 0.3 }))
    await whatsappWebhook(t, 'Knust')
    await settle(t)
    expect(await order()).toMatchObject({ status: 'awaiting_confirmation', address: 'Knust' })
  })
})

describe('customer asks for the delivery code', () => {
  it('sends a fresh code that the rider can use', async () => {
    const { t, ama, productId, order, sent } = await world()
    const orderId = await paidOrder(t, productId)
    const { riderLink } = await ama.action(api.deliveries.dispatch, { orderId, riderName: 'Yaw', riderPhone: '0271234567' })
    expect(riderLink).toMatch(/\/r\/[0-9a-f]{64}$/)
    await settle(t)

    await whatsappWebhook(t, 'Whats the code, the rider is here')
    await settle(t)
    const codes = (await sent()).filter((m) => m.recipient === CUSTOMER && m.text?.includes('delivery code'))
    expect(codes).toHaveLength(2)
    const latest = codes.sort((a, b) => b._creationTime - a._creationTime)[0]
    const pin = /delivery code is (\d{4})/.exec(latest.text!)![1]
    const token = riderLink.split('/r/')[1]
    expect(await t.mutation(api.deliveries.riderConfirm, { token, pin })).toMatchObject({ ok: true })
    expect((await order()).status).toBe('delivered')
  })
})

async function pictureWebhook(t: T, caption?: string) {
  return evolutionWebhook(
    t,
    upsert(INSTANCE, {
      key: { remoteJid: `${CUSTOMER_WA}@s.whatsapp.net`, fromMe: false, id: `IMG${++messageCounter}` },
      pushName: 'Kofi',
      messageType: 'imageMessage',
      message: { imageMessage: { mimetype: 'image/jpeg', ...(caption ? { caption } : {}) } },
    }),
  )
}

describe('customer sends a picture', () => {
  it('adds a clearly matching product to the order', async () => {
    const { t, productId, answers, order, sent } = await world()
    answers.push({ description: 'A plate of jollof rice with chicken', text_in_image: null, matches: [{ product_id: productId, confidence: 0.92 }] })
    await pictureWebhook(t, 'Do you have this?')
    await settle(t)
    expect((await order()).items[0]).toMatchObject({ productId, qty: 1, unitPricePesewas: 6500 })
    expect((await sent()).some((m) => m.text?.startsWith('That looks like our Jollof with chicken'))).toBe(true)
    const stored = await t.run(async (ctx) => (await ctx.db.query('inboundMessages').first())!)
    expect(stored.mediaId).toBeDefined()
  })

  it('offers choices when it is a close call', async () => {
    const { t, sellerId, productId, answers, sent } = await world()
    const other = await t.run((ctx) => ctx.db.insert('products', { sellerId, name: 'Jollof with fish', pricePesewas: 7000, stock: 3, active: true }))
    answers.push({
      description: 'Jollof rice',
      text_in_image: null,
      matches: [
        { product_id: productId, confidence: 0.6 },
        { product_id: other, confidence: 0.55 },
      ],
    })
    await pictureWebhook(t)
    await settle(t)
    expect(await t.run((ctx) => ctx.db.query('orders').take(5))).toEqual([])
    expect((await sent()).some((m) => m.text?.startsWith('Is it one of these?'))).toBe(true)
  })

  it('shows the seller the picture when nothing matches', async () => {
    const { t, ama, answers, sent } = await world()
    answers.push({ description: 'A pair of sneakers', text_in_image: 'Nike', matches: [] })
    await pictureWebhook(t)
    await settle(t)
    const overview = await ama.query(api.dashboard.today, {})
    const item = overview!.attention.find((a) => a.type === 'low_confidence')!
    expect(item.summary).toContain('A pair of sneakers')
    expect(item.imageUrl).toMatch(/^https?:/)
    expect((await sent()).some((m) => m.text?.startsWith('Thanks for the picture'))).toBe(true)
  })

  it('still passes the picture to the seller when the AI answer is unusable', async () => {
    const { t, ama, answers } = await world()
    answers.push('not json at all')
    await pictureWebhook(t)
    await settle(t)
    const overview = await ama.query(api.dashboard.today, {})
    expect(overview!.attention.some((a) => a.imageUrl !== null)).toBe(true)
  })
})

describe('ordering for someone else', () => {
  it('keeps the receiver on the order and texts them the delivery code', async () => {
    const { t, ama, productId, answers, order, sent, calls } = await world()
    realSms()
    answers.push(
      answer({
        items: [{ product_id: productId, quantity: 1 }],
        address: 'Adenta, GA-183-8164',
        recipient_name: 'Akos',
        recipient_phone: '024 555 1234',
      }),
    )
    await whatsappWebhook(t, 'One jollof for my sister Akos, 024 555 1234, Adenta GA-183-8164')
    await settle(t)
    const o = await order()
    expect(o).toMatchObject({
      status: 'awaiting_confirmation',
      recipientName: 'Akos',
      recipientPhone: '+233245551234',
      digitalAddress: 'GA-183-8164',
    })
    const summary = (await sent()).find((m) => m.text?.includes('Please confirm'))!.text!
    expect(summary).toContain('Receiver: Akos (024 555 1234)')
    expect(summary).not.toContain('location pin') // the digital address is enough

    // Paid and sent out: the buyer gets the code on WhatsApp, the receiver by SMS.
    await t.run((ctx) => ctx.db.patch(o._id, { status: 'paid', paymentStatus: 'paid' }))
    await ama.action(api.deliveries.dispatch, { orderId: o._id, riderName: 'Yaw', riderPhone: '027 123 4567' })
    await settle(t)
    const buyerText = (await sent()).find((m) => m.recipient === CUSTOMER && m.text?.includes('delivery code'))!.text!
    const pin = /delivery code is (\d{4})/.exec(buyerText)![1]
    const sms = calls.filter((c) => c.url.includes('sms.sasusync.com/api/v1/send') && JSON.stringify(c.body).includes('233245551234'))
    expect(sms).toHaveLength(1)
    expect(sms[0].body).toMatchObject({ sender: 'Stallo', recipients: ['233245551234'] })
    expect((sms[0].body as { message: string }).message).toContain(`Your delivery code is ${pin}`)
    const riderText = (await sent()).find((m) => m.recipient === RIDER)!.text!
    expect(riderText).toContain('Deliver to: Akos (024 555 1234)')
    expect(riderText).toContain('Digital address: GA-183-8164')

    const token = /\/r\/([0-9a-f]{64})/.exec(riderText)![1]
    const job = await t.query(api.deliveries.riderJob, { token })
    expect(job).toMatchObject({ recipientName: 'Akos', recipientPhone: '+233245551234', digitalAddress: 'GA-183-8164', hasPin: false })
    expect(job!.mapsUrl).toContain('GA-183-8164')
  })

  it('tells the seller when the code SMS cannot be sent', async () => {
    const { t, ama, productId } = await world()
    realSms('')
    const orderId = await paidOrder(t, productId, { recipientName: 'Akos', recipientPhone: '+233245551234' })
    await ama.action(api.deliveries.dispatch, { orderId, riderName: 'Yaw', riderPhone: '027 123 4567' })
    await settle(t)
    const items = await t.run((ctx) => ctx.db.query('attentionItems').collect())
    expect(items.some((i) => i.type === 'message_failed' && i.orderId === orderId)).toBe(true)
  })

  it('asks again when the receiver’s number is not a Ghana mobile number', async () => {
    const { t, productId, answers, order, sent } = await world()
    answers.push(answer({ items: [{ product_id: productId, quantity: 1 }], address: 'Legon', recipient_name: 'Akos', recipient_phone: '12345' }))
    await whatsappWebhook(t, 'Jollof for Akos at Legon, her number 12345')
    await settle(t)
    expect((await order()).recipientPhone).toBeUndefined()
    expect((await sent()).some((m) => m.text?.includes("couldn't read Akos's phone number"))).toBe(true)
  })
})

describe('checking the address', () => {
  it('asks for a location pin after a typed address', async () => {
    const { t, productId, answers, sent } = await world()
    answers.push(answer({ items: [{ product_id: productId, quantity: 1 }], address: 'Madina, near the zongo junction' }))
    await whatsappWebhook(t, 'One jollof to Madina zongo junction')
    await settle(t)
    expect((await sent()).find((m) => m.text?.includes('Please confirm'))!.text).toContain('share the location pin')
  })

  it('flags an address outside the seller’s delivery areas', async () => {
    const { t, sellerId, productId, answers, order, sent } = await world()
    await t.run((ctx) => ctx.db.patch(sellerId, { deliveryAreas: 'Madina, Adenta, Legon' }))
    answers.push(answer({ items: [{ product_id: productId, quantity: 1 }], address: 'Takoradi market circle', outside_delivery_area: true }))
    await whatsappWebhook(t, 'One jollof to Takoradi market circle')
    await settle(t)
    const o = await order()
    expect(o.outsideDeliveryArea).toBe(true)
    expect((await sent()).some((m) => m.text?.includes('usually delivers to Madina, Adenta, Legon'))).toBe(true)
    const items = await t.run((ctx) => ctx.db.query('attentionItems').collect())
    expect(items.filter((i) => i.orderId === o._id && i.summary.includes('outside your delivery areas'))).toHaveLength(1)
  })

  it('ignores the area check when the seller has not set areas', async () => {
    const { t, productId, answers, order } = await world()
    answers.push(answer({ items: [{ product_id: productId, quantity: 1 }], address: 'Takoradi', outside_delivery_area: true }))
    await whatsappWebhook(t, 'One jollof to Takoradi')
    await settle(t)
    expect((await order()).outsideDeliveryArea).toBeUndefined()
  })
})

describe('delivery fees and cash on delivery', () => {
  /** Orders 2 jollof (GH₵ 130) to Madina and returns the order once Stallo has sent the summary. */
  async function orderTwo(w: Awaited<ReturnType<typeof world>>) {
    w.answers.push(answer({ items: [{ product_id: w.productId, quantity: 2 }], address: 'Madina' }))
    await whatsappWebhook(w.t, '2 jollof to Madina')
    await settle(w.t)
    return w.order()
  }
  const initialized = (calls: { url: string; body: unknown }[]) =>
    calls.filter((c) => c.url.includes('/transaction/initialize')).map((c) => c.body as { amount: string; transaction_charge: number })
  const balance = (w: Awaited<ReturnType<typeof world>>) => w.t.run(async (ctx) => (await ctx.db.get(w.sellerId))!.feeBalancePesewas ?? 0)
  const riderToken = async (w: Awaited<ReturnType<typeof world>>) =>
    /\/r\/([0-9a-f]{64})/.exec((await w.sent()).find((m) => m.recipient === RIDER)!.text!)![1]

  it('adds the delivery fee to the total but takes Stallo’s fee from the goods only', async () => {
    const w = await world()
    await w.t.run((ctx) => ctx.db.patch(w.sellerId, { deliveryFeePesewas: 2000 }))
    const o = await orderTwo(w)
    expect(o).toMatchObject({ subtotalPesewas: 13000, deliveryFeePesewas: 2000, totalPesewas: 15000 })
    const summary = (await w.sent()).find((m) => m.text?.includes('Please confirm'))!.text!
    expect(summary).toContain('Delivery — GH₵ 20.00')
    expect(summary).toContain('Total: GH₵ 150.00')
    expect(summary).not.toContain('CASH') // the seller doesn't take cash

    w.answers.push(answer({ intent: 'confirm' }))
    await whatsappWebhook(w.t, 'Yes')
    await settle(w.t)
    expect(initialized(w.calls)).toEqual([expect.objectContaining({ amount: '15000', transaction_charge: 260 })]) // 2% of 130
  })

  it('takes the goods in cash and the delivery fee online', async () => {
    const w = await world()
    await w.t.run((ctx) => ctx.db.patch(w.sellerId, { deliveryFeePesewas: 2000, acceptsCash: true }))
    await orderTwo(w)
    expect((await w.sent()).find((m) => m.text?.includes('Please confirm'))!.text).toContain('or CASH to pay the rider')

    await whatsappWebhook(w.t, 'Cash')
    await settle(w.t)
    let o = await w.order()
    expect(o).toMatchObject({ status: 'awaiting_payment', paymentMethod: 'cash', cashDuePesewas: 13000, cashStatus: 'due', feePesewas: 260 })
    expect(initialized(w.calls)).toEqual([expect.objectContaining({ amount: '2000', transaction_charge: 260 })])
    expect((await w.sent()).some((m) => m.text?.includes('pay the GH₵ 20.00 delivery fee here'))).toBe(true)

    const payment = await w.t.run(async (ctx) => (await ctx.db.query('payments').first())!)
    await paystackWebhook(w.t, 'charge.success', { reference: payment.reference })
    await settle(w.t)
    o = await w.order()
    expect(o).toMatchObject({ status: 'paid', paymentStatus: 'paid' })
    expect(await balance(w)).toBe(-260) // collected early; earned once the cash is taken

    // The rider keeps GH₵ 15 from the cash.
    await w.ama.action(api.deliveries.dispatch, { orderId: o._id, riderName: 'Yaw', riderPhone: '027 123 4567', riderFeePesewas: 1500, riderFeeFromCash: true })
    await settle(w.t)
    const riderText = (await w.sent()).find((m) => m.recipient === RIDER)!.text!
    expect(riderText).toContain('Collect GH₵ 130.00 in cash.')
    expect(riderText).toContain('Give GH₵ 115.00 to')
    const pin = /delivery code is (\d{4})/.exec((await w.sent()).find((m) => m.recipient === CUSTOMER && m.text?.includes('delivery code'))!.text!)![1]
    const token = await riderToken(w)
    expect(await w.t.query(api.deliveries.riderJob, { token })).toMatchObject({ cashToCollectPesewas: 13000, riderFeePesewas: 1500, riderFeeFromCash: true })

    // No code accepted until the rider says the cash is collected.
    expect(await w.t.mutation(api.deliveries.riderConfirm, { token, pin })).toMatchObject({ ok: false })
    expect((await w.order()).status).toBe('dispatched')
    expect(await w.t.mutation(api.deliveries.riderConfirm, { token, pin, cashCollected: true })).toMatchObject({ ok: true })
    o = await w.order()
    expect(o).toMatchObject({ status: 'delivered', cashStatus: 'with_rider' })
    expect(await balance(w)).toBe(0)

    await w.ama.mutation(api.deliveries.markCashReceived, { orderId: o._id })
    expect((await w.order()).cashStatus).toBe('received')
  })

  it('confirms a cash order straight away when there is nothing to pay online, and recovers the fee later', async () => {
    const w = await world()
    await w.t.run((ctx) => ctx.db.patch(w.sellerId, { acceptsCash: true }))
    await orderTwo(w)
    await whatsappWebhook(w.t, 'cash on delivery')
    await settle(w.t)
    let o = await w.order()
    expect(o).toMatchObject({ status: 'paid', paymentStatus: 'none', paymentMethod: 'cash', cashDuePesewas: 13000 })
    expect(initialized(w.calls)).toEqual([])
    expect((await w.t.run((ctx) => ctx.db.get(w.productId)))!.stock).toBe(3)
    expect((await w.sent()).some((m) => m.text?.includes('Please have GH₵ 130.00 ready in cash'))).toBe(true)

    await w.ama.action(api.deliveries.dispatch, { orderId: o._id, riderName: 'Yaw', riderPhone: '027 123 4567' })
    await settle(w.t)
    const pin = /delivery code is (\d{4})/.exec((await w.sent()).find((m) => m.recipient === CUSTOMER && m.text?.includes('delivery code'))!.text!)![1]
    await w.t.mutation(api.deliveries.riderConfirm, { token: await riderToken(w), pin, cashCollected: true })
    expect(await balance(w)).toBe(260) // owed from the cash sale

    // The next online order pays its own fee plus what's owed.
    await w.t.run(async (ctx) => {
      const conversation = (await ctx.db.query('conversations').first())!
      await ctx.db.patch(conversation._id, { draftOrderId: undefined, state: 'idle' })
      await ctx.db.patch(w.sellerId, { acceptsCash: false })
    })
    w.answers.push(answer({ items: [{ product_id: w.productId, quantity: 1 }], address: 'Madina' }), answer({ intent: 'confirm' }))
    await whatsappWebhook(w.t, 'One more jollof to Madina')
    await settle(w.t)
    await whatsappWebhook(w.t, 'Yes')
    await settle(w.t)
    expect(initialized(w.calls)).toEqual([expect.objectContaining({ amount: '6500', transaction_charge: 130 + 260 })])
    const payment = await w.t.run(async (ctx) => (await ctx.db.query('payments').first())!)
    await paystackWebhook(w.t, 'charge.success', { reference: payment.reference })
    await settle(w.t)
    o = await w.t.run(async (ctx) => (await ctx.db.get(payment.orderId))!)
    expect(o.status).toBe('paid')
    expect(await balance(w)).toBe(0)
  })

  it('does not offer cash while the seller owes too much', async () => {
    const w = await world()
    await w.t.run((ctx) => ctx.db.patch(w.sellerId, { acceptsCash: true, feeBalancePesewas: 6000 }))
    await orderTwo(w)
    expect((await w.sent()).find((m) => m.text?.includes('Please confirm'))!.text).not.toContain('CASH')
    await whatsappWebhook(w.t, 'Cash')
    await settle(w.t)
    expect((await w.order()).status).toBe('awaiting_confirmation')
    expect((await w.sent()).some((m) => m.text?.includes('can only take payment online'))).toBe(true)
  })
})
