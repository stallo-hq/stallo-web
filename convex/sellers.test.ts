import { describe, expect, it } from 'vitest'
import { account, phoneToken, seller, setup } from '../test/convexTest'
import { api } from './_generated/api'

const jollof = { name: 'Jollof with chicken', pricePesewas: 6500, stock: 20, active: true }

describe('phone verification', () => {
  it('blocks setting up a business until the phone is confirmed', async () => {
    const t = setup()
    const ama = await account(t, '+233241234567')
    await expect(ama.mutation(api.sellers.create, { businessName: 'Ama’s Kitchen' })).rejects.toThrow(/Confirm your phone/)
    expect(await ama.query(api.account.me, {})).toEqual({ phone: '+233241234567', phoneVerified: false, hasSeller: false })
  })

  it('rejects a wrong code', async () => {
    const t = setup()
    await t.action(api.phoneVerification.sendCode, { phone: '024 123 4567' })
    await expect(t.action(api.phoneVerification.verifyCode, { phone: '0241234567', code: '000000' })).rejects.toThrow(/isn’t right/)
  })

  it('rejects numbers that are not Ghana mobiles', async () => {
    const t = setup()
    await expect(t.action(api.phoneVerification.sendCode, { phone: '12345' })).rejects.toThrow(/Ghana mobile/)
  })

  it('uses a token once, and only for the number it was issued for', async () => {
    const t = setup()
    const ama = await account(t, '+233241234567')
    const kofisToken = await phoneToken(t, '+233551234567')
    await expect(ama.mutation(api.account.confirmPhone, { token: kofisToken })).rejects.toThrow(/expired/)

    const token = await phoneToken(t, '+233241234567')
    await ama.mutation(api.account.confirmPhone, { token })
    const kofi = await account(t, '+233551234567')
    await expect(kofi.mutation(api.account.confirmPhone, { token })).rejects.toThrow(/expired/)
    expect((await ama.query(api.account.me, {}))?.phoneVerified).toBe(true)
  })

  it('stops guessing a code after 3 wrong tries, until a new code is sent', async () => {
    const t = setup()
    const phone = '+233241234567'
    await t.action(api.phoneVerification.sendCode, { phone })
    for (let i = 0; i < 3; i++) {
      await expect(t.action(api.phoneVerification.verifyCode, { phone, code: '000000' })).rejects.toThrow(/isn’t right/)
    }
    await expect(t.action(api.phoneVerification.verifyCode, { phone, code: '123456' })).rejects.toThrow(/Too many wrong tries/)

    await t.action(api.phoneVerification.sendCode, { phone })
    expect((await t.action(api.phoneVerification.verifyCode, { phone, code: '123456' })).token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('limits wrong guesses per number per hour, across codes', async () => {
    const t = setup()
    const phone = '+233241234567'
    const wrong = () => t.action(api.phoneVerification.verifyCode, { phone, code: '000000' })
    for (let code = 0; code < 3; code++) {
      await t.action(api.phoneVerification.sendCode, { phone })
      for (let i = 0; i < 3; i++) await expect(wrong()).rejects.toThrow(/isn’t right/)
    }
    await t.action(api.phoneVerification.sendCode, { phone })
    await expect(wrong()).rejects.toThrow(/isn’t right/) // the 10th wrong guess this hour
    await t.action(api.phoneVerification.sendCode, { phone })
    await expect(t.action(api.phoneVerification.verifyCode, { phone, code: '123456' })).rejects.toThrow(/Too many wrong codes/)
  })

  it('refuses a guess when no code was sent to the number', async () => {
    const t = setup()
    await expect(t.action(api.phoneVerification.verifyCode, { phone: '+233241234567', code: '123456' })).rejects.toThrow(/expired/)
  })

  it('does not count other numbers’ guesses', async () => {
    const t = setup()
    await t.action(api.phoneVerification.sendCode, { phone: '+233241234567' })
    for (let i = 0; i < 3; i++) {
      await expect(t.action(api.phoneVerification.verifyCode, { phone: '+233241234567', code: '000000' })).rejects.toThrow(/isn’t right/)
    }
    expect(await phoneToken(t, '+233551234567')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('limits codes per number', async () => {
    const t = setup()
    for (let i = 0; i < 5; i++) await t.action(api.phoneVerification.sendCode, { phone: '+233241234567' })
    await expect(t.action(api.phoneVerification.sendCode, { phone: '+233241234567' })).rejects.toThrow(/Too many/)
  })
})

describe('sellers', () => {
  it('creates the business once, with the sign-up phone number', async () => {
    const t = setup()
    const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
    await ama.mutation(api.sellers.create, { businessName: 'Second try' })
    const me = await ama.query(api.sellers.mine, {})
    expect(me).toMatchObject({ businessName: 'Ama’s Kitchen', phone: '+233241234567', whatsappConnected: false })
  })

  it('rejects signed-out callers', async () => {
    const t = setup()
    await expect(t.mutation(api.products.create, jollof)).rejects.toThrow(/Not signed in/)
    expect(await t.query(api.products.list, {})).toEqual([])
    expect(await t.query(api.sellers.mine, {})).toBeNull()
  })
})

describe('products', () => {
  it('validates input', async () => {
    const t = setup()
    const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
    await expect(ama.mutation(api.products.create, { ...jollof, name: '  ' })).rejects.toThrow()
    await expect(ama.mutation(api.products.create, { ...jollof, pricePesewas: 0 })).rejects.toThrow()
    await expect(ama.mutation(api.products.create, { ...jollof, stock: 1.5 })).rejects.toThrow()
  })

  it('never lets one seller read or change another seller’s products', async () => {
    const t = setup()
    const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
    const kofi = await seller(t, '+233551234567', 'Kofi Foods')

    const amaProduct = await ama.mutation(api.products.create, jollof)

    expect(await kofi.query(api.products.list, {})).toEqual([])
    await expect(
      kofi.mutation(api.products.update, { productId: amaProduct, ...jollof, pricePesewas: 1 }),
    ).rejects.toThrow(/not found/)
    await expect(kofi.mutation(api.products.remove, { productId: amaProduct })).rejects.toThrow(/not found/)

    const [stillThere] = await ama.query(api.products.list, {})
    expect(stillThere).toMatchObject({ _id: amaProduct, pricePesewas: 6500 })
  })

  it('lets the owner edit and delete', async () => {
    const t = setup()
    const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
    const id = await ama.mutation(api.products.create, jollof)
    await ama.mutation(api.products.update, { productId: id, ...jollof, stock: 3 })
    expect((await ama.query(api.products.list, {}))[0].stock).toBe(3)
    await ama.mutation(api.products.remove, { productId: id })
    expect(await ama.query(api.products.list, {})).toEqual([])
  })
})

describe('orders and dashboard', () => {
  it('only shows a seller their own orders', async () => {
    const t = setup()
    const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
    const kofi = await seller(t, '+233551234567', 'Kofi Foods')
    const amaSeller = (await ama.query(api.sellers.mine, {}))!

    await t.run(async (ctx) => {
      const customerId = await ctx.db.insert('customers', { sellerId: amaSeller._id, phone: '+233201112222' })
      const productId = await ctx.db.insert('products', { sellerId: amaSeller._id, ...jollof })
      await ctx.db.insert('orders', {
        sellerId: amaSeller._id,
        customerId,
        items: [{ productId, name: 'Jollof with chicken', unitPricePesewas: 6500, qty: 2 }],
        subtotalPesewas: 13000,
        feePesewas: 0,
        totalPesewas: 13000,
        status: 'awaiting_payment',
        paymentStatus: 'pending',
        timeline: [],
        createdAt: Date.now(),
      })
    })

    expect(await ama.query(api.orders.list, { filter: 'active' })).toHaveLength(1)
    expect(await kofi.query(api.orders.list, { filter: 'all' })).toEqual([])
    expect((await ama.query(api.dashboard.today, {}))?.stats.awaitingPayment).toBe(1)
    expect((await kofi.query(api.dashboard.today, {}))?.stats.awaitingPayment).toBe(0)
  })
})
