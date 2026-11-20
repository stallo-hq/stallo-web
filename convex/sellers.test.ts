/// <reference types="vite/client" />
import { registerCore, sessionIdentity } from '@convex-dev/auth/test'
import { registerUsername } from '@convex-dev/auth/components/username/test'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, components } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

function setup() {
  const t = convexTest(schema, modules)
  registerCore(t)
  registerUsername(t)
  return t
}

type T = ReturnType<typeof setup>

const TTL = { accessTokenTtlSeconds: 3600, refreshInactivityTimeoutSeconds: 86400, sessionMaxLifetimeSeconds: 86400 }

/**
 * A signed-in seller. Does what password sign-up does once the password is
 * checked (the password hashing itself doesn't run under vitest): create the
 * user, store the phone number as the username, open a real session.
 */
async function seller(t: T, phone: string, businessName: string) {
  const userId = await t.run((ctx) => ctx.db.insert('users', { createdAt: Date.now() }))
  await t.mutation(components.authUsername.public.setUsername, { userId, username: phone })
  const tokens = await t.mutation(components.auth.public._internal_dangerous_signIn, {
    claims: { method: 'usernamePassword', profile: {} },
    componentPath: 'authUsername',
    userId,
    ...TTL,
  })
  const as = t.withIdentity(sessionIdentity(tokens))
  await as.mutation(api.sellers.create, { businessName })
  return as
}

const jollof = { name: 'Jollof with chicken', pricePesewas: 6500, stock: 20, active: true }

describe('sellers', () => {
  it('creates the business once, with the sign-up phone number', async () => {
    const t = setup()
    const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
    await ama.mutation(api.sellers.create, { businessName: 'Second try' })
    const me = await ama.query(api.sellers.mine, {})
    expect(me).toMatchObject({ businessName: 'Ama’s Kitchen', phone: '+233241234567', whatsappConnected: false })
  })

  it('keeps the first setup request time', async () => {
    const t = setup()
    const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
    await ama.mutation(api.sellers.requestSetup, { kind: 'whatsapp' })
    const first = (await ama.query(api.sellers.mine, {}))?.whatsappSetupRequestedAt
    await ama.mutation(api.sellers.requestSetup, { kind: 'whatsapp' })
    expect(first).toBeTypeOf('number')
    expect((await ama.query(api.sellers.mine, {}))?.whatsappSetupRequestedAt).toBe(first)
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
