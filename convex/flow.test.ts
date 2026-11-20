import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { claudeAnswer, mockFetch, seller, setup, type T } from '../test/convexTest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { Extraction } from './integrations/assistant'
import { hmacHex } from './model/crypto'

/**
 * End to end through the real webhooks, scheduler and integrations, with
 * WhatsApp, Claude and Paystack replaced by a fake fetch.
 */

const SELLER_NUMBER_ID = '111000111'
const CUSTOMER_WA = '233201112222'
const CUSTOMER = '+233201112222'
const RIDER = '+233271234567'

function answer(partial: Partial<Extraction>): Extraction {
  return { intent: 'order', items: null, address: null, customer_name: null, unmatched: [], reply: null, confidence: 0.95, ...partial }
}

let messageCounter = 0
async function whatsappWebhook(t: T, text: string, from = CUSTOMER_WA, opts: { id?: string; secret?: string } = {}) {
  const body = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: SELLER_NUMBER_ID },
              contacts: [{ wa_id: from, profile: { name: 'Kofi' } }],
              messages: [{ id: opts.id ?? `wamid.in.${++messageCounter}`, from, type: 'text', text: { body: text } }],
            },
          },
        ],
      },
    ],
  })
  return t.fetch('/whatsapp/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${await hmacHex('SHA-256', opts.secret ?? 'app-secret', body)}` },
    body,
  })
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
    await ctx.db.patch(sellerId, { whatsappPhoneNumberId: SELLER_NUMBER_ID, paystackSubaccountCode: 'ACCT_test' })
    return ctx.db.insert('products', { sellerId, name: 'Jollof with chicken', pricePesewas: 6500, stock: 5, active: true })
  })

  const answers: unknown[] = []
  const paystack = { amount: 0 }
  const calls = mockFetch({
    'graph.facebook.com/': (url) =>
      url.pathname.endsWith('/media-1')
        ? { url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/media-1', mime_type: 'image/jpeg', file_size: 4 }
        : { messages: [{ id: `wamid.out.${Math.random()}` }] },
    'lookaside.fbsbx.com/': () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { headers: { 'content-type': 'image/jpeg' } }),
    'api.anthropic.com/v1/messages': () => claudeAnswer(answers.shift() ?? answer({ intent: 'other', confidence: 0.2 })),
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
  vi.stubEnv('WHATSAPP_APP_SECRET', 'app-secret')
  vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'test-token')
  vi.stubEnv('WHATSAPP_VERIFY_TOKEN', 'verify-me')
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_flow')
  vi.stubEnv('PAYSTACK_WEBHOOK_SECRET', '')
  vi.stubEnv('PLATFORM_FEE_PERCENT', '2')
  vi.stubEnv('PLATFORM_FEE_FLAT_PESEWAS', '0')
  vi.stubEnv('SITE_URL', 'https://stallo.test')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('WhatsApp webhook', () => {
  it('answers Meta’s verification only with the right token', async () => {
    const { t } = await world()
    const ok = await t.fetch('/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42')
    expect(ok.status).toBe(200)
    expect(await ok.text()).toBe('42')
    expect((await t.fetch('/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42')).status).toBe(403)
  })

  it('rejects a bad signature and stores nothing', async () => {
    const { t } = await world()
    expect((await whatsappWebhook(t, 'Hi', CUSTOMER_WA, { secret: 'wrong' })).status).toBe(401)
    expect(await t.run((ctx) => ctx.db.query('inboundMessages').collect())).toEqual([])
  })

  it('rejects everything when the app secret is not set', async () => {
    const { t } = await world()
    vi.stubEnv('WHATSAPP_APP_SECRET', '')
    expect((await whatsappWebhook(t, 'Hi')).status).toBe(401)
  })

  it('handles Meta’s retries of the same message once', async () => {
    const { t, answers, sent } = await world()
    answers.push(answer({ intent: 'greeting' }), answer({ intent: 'greeting' }))
    expect((await whatsappWebhook(t, 'Hello', CUSTOMER_WA, { id: 'wamid.same' })).status).toBe(200)
    expect((await whatsappWebhook(t, 'Hello', CUSTOMER_WA, { id: 'wamid.same' })).status).toBe(200)
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
async function paidOrder(t: T, productId: Id<'products'>) {
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
  const body = JSON.stringify({
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: SELLER_NUMBER_ID },
              contacts: [{ wa_id: CUSTOMER_WA, profile: { name: 'Kofi' } }],
              messages: [
                { id: `wamid.in.${++messageCounter}`, from: CUSTOMER_WA, type: 'image', image: { id: 'media-1', mime_type: 'image/jpeg', caption } },
              ],
            },
          },
        ],
      },
    ],
  })
  return t.fetch('/whatsapp/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${await hmacHex('SHA-256', 'app-secret', body)}` },
    body,
  })
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
