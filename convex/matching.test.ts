import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { claudeAnswer, mockFetch, seller, setup, type T } from '../test/convexTest'
import { WEBHOOK_SECRET, evolutionAuth, textUpsert } from '../test/evolution'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { EMBEDDING_DIMENSIONS, HuggingFaceError, embed, normalise, parseEmbeddings } from './integrations/huggingface'
import { SHORTLIST_SIZE, productText, shortlist } from './model/matching'

/** A stand-in for the model: each word lights up one dimension, so texts sharing words are close. */
function fakeVector(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    let h = 0
    for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) % EMBEDDING_DIMENSIONS
    v[h] += 1
  }
  v[EMBEDDING_DIMENSIONS - 1] += 0.01 // never all zero
  return v
}

const HF = 'router.huggingface.co/hf-inference/models/'

function hfRoute(state: { down: boolean; calls: number }) {
  return {
    [HF]: (_url: URL, init: RequestInit | undefined) => {
      state.calls++
      if (state.down) return new Response(JSON.stringify({ error: 'Model is loading' }), { status: 503 })
      const { inputs } = JSON.parse(String(init?.body)) as { inputs: string[] }
      return inputs.map(fakeVector)
    },
  }
}

const settle = (t: T) => t.finishAllScheduledFunctions(vi.runAllTimers)

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('HUGGINGFACE_API_KEY', 'hf_test')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Hugging Face embeddings', () => {
  it('reads pooled vectors and mean-pools token vectors, normalising both', () => {
    const pooled = parseEmbeddings([fakeVector('jollof')], 1)[0]
    expect(pooled).toHaveLength(EMBEDDING_DIMENSIONS)
    expect(Math.hypot(...pooled)).toBeCloseTo(1)
    const tokens = [new Array(EMBEDDING_DIMENSIONS).fill(1), new Array(EMBEDDING_DIMENSIONS).fill(3)]
    expect(parseEmbeddings([tokens], 1)[0]).toEqual(normalise(new Array(EMBEDDING_DIMENSIONS).fill(2)))
  })

  it('rejects the wrong size, count or junk', () => {
    expect(() => parseEmbeddings([[1, 2, 3]], 1)).toThrow(/384/)
    expect(() => parseEmbeddings([fakeVector('a')], 2)).toThrow(HuggingFaceError)
    expect(() => parseEmbeddings({ error: 'x' }, 1)).toThrow(HuggingFaceError)
    expect(() => parseEmbeddings([['a']], 1)).toThrow(HuggingFaceError)
  })

  it('calls the feature-extraction pipeline with the key, and sorts errors', async () => {
    const state = { down: false, calls: 0 }
    const calls = mockFetch(hfRoute(state))
    await embed(['jollof'])
    expect(calls[0].url).toBe(`https://${HF}sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/pipeline/feature-extraction`)
    expect(calls[0].body).toEqual({ inputs: ['jollof'] })

    state.down = true
    await expect(embed(['x'])).rejects.toMatchObject({ kind: 'temporary' })
    mockFetch({ [HF]: () => new Response('{}', { status: 401 }) })
    await expect(embed(['x'])).rejects.toMatchObject({ kind: 'not_configured' })
    vi.stubEnv('HUGGINGFACE_API_KEY', '')
    await expect(embed(['x'])).rejects.toMatchObject({ kind: 'not_configured' })
  })
})

describe('shortlist', () => {
  const products = Array.from({ length: 60 }, (_, i) => ({ id: `p${i}` }))

  it('leaves small catalogues and missing rankings alone', () => {
    expect(shortlist(products.slice(0, 10), ['p3'], new Set())).toHaveLength(10)
    expect(shortlist(products, null, new Set())).toBe(products)
  })

  it('keeps the basket, then the best matches, then fills up to the limit', () => {
    const result = shortlist(products, ['p50', 'p51'], new Set(['p59']), 5).map((p) => p.id)
    expect(result).toEqual(['p59', 'p50', 'p51', 'p0', 'p1'])
  })

  it('never drops basket items, even past the limit', () => {
    const keep = new Set(['p10', 'p11', 'p12'])
    expect(shortlist(products, ['p1'], keep, 2).map((p) => p.id)).toEqual(['p10', 'p11', 'p12'])
  })

  it('embeds the name, plus the photo description when there is one', () => {
    expect(productText({ name: ' Kelewele ', photoDescription: undefined })).toBe('Kelewele')
    expect(productText({ name: 'Kelewele', photoDescription: 'Fried plantain cubes' })).toBe('Kelewele. Fried plantain cubes')
  })
})

describe('product embeddings', () => {
  const rows = (t: T) => t.run((ctx) => ctx.db.query('productEmbeddings').collect())

  it('embeds a new product, re-embeds on rename, and removes it with the product', async () => {
    const t = setup()
    const state = { down: false, calls: 0 }
    mockFetch(hfRoute(state))
    const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
    const productId = await ama.mutation(api.products.create, { name: 'Jollof with chicken', pricePesewas: 6500, stock: 5, active: true })
    await settle(t)
    expect(await rows(t)).toEqual([expect.objectContaining({ productId, text: 'Jollof with chicken' })])

    await ama.mutation(api.products.update, { productId, name: 'Jollof with chicken', pricePesewas: 7000, stock: 5, active: true })
    await settle(t)
    expect(state.calls).toBe(1) // price change: nothing to re-embed

    await ama.mutation(api.products.update, { productId, name: 'Jollof with fish', pricePesewas: 7000, stock: 5, active: true })
    await settle(t)
    expect((await rows(t)).map((r) => r.text)).toEqual(['Jollof with fish'])

    await ama.mutation(api.products.remove, { productId })
    expect(await rows(t)).toEqual([])
  })

  it('retries while the model is loading, and does nothing without a key', async () => {
    const t = setup()
    const state = { down: true, calls: 0 }
    mockFetch(hfRoute(state))
    const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
    await ama.mutation(api.products.create, { name: 'Waakye', pricePesewas: 3000, stock: 5, active: true })
    await t.finishInProgressScheduledFunctions()
    state.down = false
    await settle(t)
    expect(await rows(t)).toHaveLength(1)

    vi.stubEnv('HUGGINGFACE_API_KEY', '')
    const before = state.calls
    await ama.mutation(api.products.create, { name: 'Banku', pricePesewas: 2000, stock: 5, active: true })
    await settle(t)
    expect(state.calls).toBe(before)
  })

  it('reports a working setup from the check function', async () => {
    const t = setup()
    mockFetch(hfRoute({ down: false, calls: 0 }))
    expect(await t.action(internal.matching.check, {})).toMatchObject({ ok: true, dimensions: EMBEDDING_DIMENSIONS })
    vi.stubEnv('HUGGINGFACE_API_KEY', '')
    expect(await t.action(internal.matching.check, {})).toMatchObject({ ok: false, error: expect.stringMatching(/HUGGINGFACE_API_KEY/) })
  })
})

describe('matching a message against a big catalogue', () => {
  const INSTANCE = 'stallo-match01'

  async function bigShop(state: { down: boolean; calls: number }) {
    vi.stubEnv('EVOLUTION_API_URL', 'https://evolution.test')
    vi.stubEnv('EVOLUTION_API_KEY', 'k')
    vi.stubEnv('EVOLUTION_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const t = setup()
    const calls = mockFetch({
      ...hfRoute(state),
      'evolution.test/': () => ({ key: { id: `OUT${Math.random()}` } }),
      'api.anthropic.com/v1/messages': () =>
        claudeAnswer({ intent: 'question', items: null, address: null, customer_name: null, recipient_name: null, recipient_phone: null, outside_delivery_area: null, pay_with: null, unmatched: [], reply: 'Yes we have it.', confidence: 0.9 }),
    })
    const ama = await seller(t, '+233241234567', 'Ama’s Kitchen')
    const sellerId = (await ama.query(api.sellers.mine, {}))!._id
    await t.run((ctx) => ctx.db.patch(sellerId, { whatsappInstance: INSTANCE, whatsappConnectedAt: Date.now() - 30 * 86400_000 }))
    const names = ['Kelewele with groundnuts', ...Array.from({ length: SHORTLIST_SIZE + 19 }, (_, i) => `Phone case model ${i}`)]
    const ids: Id<'products'>[] = []
    for (const name of names) ids.push(await ama.mutation(api.products.create, { name, pricePesewas: 1000, stock: 5, active: true }))
    await settle(t)
    return { t, calls, kelewele: ids[0] }
  }

  async function ask(t: T, text: string) {
    await t.fetch('/evolution/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: await evolutionAuth() },
      body: JSON.stringify(textUpsert(INSTANCE, '233201112222', text, `M${Math.random()}`)),
    })
    await settle(t)
  }

  const prompt = (calls: { url: string; body: unknown }[]) => JSON.stringify(calls.filter((c) => c.url.includes('anthropic')).at(-1)!.body)

  it('shows the assistant the closest products, not all of them', async () => {
    const state = { down: false, calls: 0 }
    const { t, calls, kelewele } = await bigShop(state)
    await ask(t, 'Do you have kelewele?')
    const sent = prompt(calls)
    expect(sent).toContain(kelewele)
    expect(sent.match(/id=/g)).toHaveLength(SHORTLIST_SIZE)
  })

  it('falls back to the whole catalogue when Hugging Face is down', async () => {
    const state = { down: false, calls: 0 }
    const { t, calls } = await bigShop(state)
    state.down = true
    await ask(t, 'Do you have kelewele?')
    expect(prompt(calls).match(/id=/g)).toHaveLength(SHORTLIST_SIZE + 20)
    expect(await t.run((ctx) => ctx.db.query('inboundMessages').first())).toMatchObject({ status: 'done' })
  })
})
