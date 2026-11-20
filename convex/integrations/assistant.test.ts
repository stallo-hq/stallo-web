import { afterEach, describe, expect, it, vi } from 'vitest'
import { claudeAnswer, mockFetch } from '../../test/convexTest'
import { buildUserMessage, extract, sanitize, type AssistantInput, type Extraction } from './assistant'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const ids = new Set(['p_jollof', 'p_sobolo', 'p_waakye'])

function answer(partial: Partial<Extraction>): Extraction {
  return {
    intent: 'order',
    items: null,
    address: null,
    customer_name: null,
    recipient_name: null,
    recipient_phone: null,
    outside_delivery_area: null,
    unmatched: [],
    reply: null,
    confidence: 0.95,
    ...partial,
  }
}

const input: AssistantInput = {
  businessName: 'Ama’s Kitchen',
  products: [
    { id: 'p_jollof', name: 'Jollof with chicken', price: 'GH₵ 65.00', available: true },
    { id: 'p_sobolo', name: 'Sobolo (500ml)', price: 'GH₵ 10.00', available: true },
    { id: 'p_waakye', name: 'Waakye', price: 'GH₵ 40.00', available: false },
  ],
  basket: [],
  address: null,
  recipient: null,
  deliveryAreas: null,
  awaitingConfirmation: false,
  history: [],
  message: 'Pls I want 2 jollof and 1 sobolo, deliver to Madina zongo junction',
}

describe('sanitize (the model never decides beyond what the seller sells)', () => {
  it('drops products that are not on the list', () => {
    const out = sanitize(answer({ items: [{ product_id: 'p_jollof', quantity: 2 }, { product_id: 'p_pizza', quantity: 1 }] }), ids)
    expect(out.items).toEqual([{ product_id: 'p_jollof', quantity: 2 }])
  })

  it('keeps one line per product, rounds and caps quantities, removes zero', () => {
    const out = sanitize(
      answer({
        items: [
          { product_id: 'p_jollof', quantity: 1 },
          { product_id: 'p_jollof', quantity: 2.6 },
          { product_id: 'p_sobolo', quantity: 500 },
          { product_id: 'p_waakye', quantity: 0 },
        ],
      }),
      ids,
    )
    expect(out.items).toEqual([
      { product_id: 'p_jollof', quantity: 3 },
      { product_id: 'p_sobolo', quantity: 99 },
    ])
  })

  it('keeps null (basket unchanged) distinct from empty', () => {
    expect(sanitize(answer({ items: null }), ids).items).toBeNull()
    expect(sanitize(answer({ items: [] }), ids).items).toEqual([])
  })

  it('clamps confidence and trims text', () => {
    const out = sanitize(answer({ confidence: 7, address: '  Madina  ', reply: '   ' }), ids)
    expect(out.confidence).toBe(1)
    expect(out.address).toBe('Madina')
    expect(out.reply).toBeNull()
  })
})

describe('prompt', () => {
  it('gives the model ids, prices and availability, and the new message', () => {
    const text = buildUserMessage(input)
    expect(text).toContain('id=p_jollof | Jollof with chicken | GH₵ 65.00')
    expect(text).toContain('Waakye | GH₵ 40.00 | NOT AVAILABLE')
    expect(text).toContain(input.message)
  })
})

describe('extract', () => {
  it('refuses to run without a key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    await expect(extract(input)).rejects.toThrow(/ANTHROPIC_API_KEY/)
  })

  // Customers mix English, Pidgin and Twi; the structured answer is parsed the same way.
  const samples: [string, Extraction][] = [
    [
      'Pls I want 2 jollof and 1 sobolo, deliver to Madina zongo junction',
      answer({
        items: [
          { product_id: 'p_jollof', quantity: 2 },
          { product_id: 'p_sobolo', quantity: 1 },
        ],
        address: 'Madina zongo junction',
      }),
    ],
    ['Abeg make am 3 jollof', answer({ items: [{ product_id: 'p_jollof', quantity: 3 }] })],
    ['Me pɛ waakye baako', answer({ items: [{ product_id: 'p_waakye', quantity: 1 }], confidence: 0.85 })],
    ['Aane, yɛnkɔ', answer({ intent: 'confirm' })],
    ['I no want again', answer({ intent: 'cancel' })],
  ]

  for (const [message, expected] of samples) {
    it(`parses the answer for “${message}”`, async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
      const calls = mockFetch({ 'api.anthropic.com/v1/messages': () => claudeAnswer(expected) })
      const out = await extract({ ...input, message })
      expect(out.intent).toBe(expected.intent)
      expect(out.items).toEqual(expected.items)
      const body = calls[0].body as { model: string; output_config: { effort: string; format: { type: string } } }
      expect(body.model).toBe('claude-haiku-5-5')
      expect(body.output_config.effort).toBe('low')
      expect(body.output_config.format.type).toBe('json_schema')
    })
  }

  it('uses LLM_MODEL when set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubEnv('LLM_MODEL', 'claude-sonnet-5-5')
    const calls = mockFetch({ 'api.anthropic.com/v1/messages': () => claudeAnswer(answer({ intent: 'greeting' })) })
    await extract({ ...input, message: 'Hello' })
    expect((calls[0].body as { model: string }).model).toBe('claude-sonnet-5-5')
  })
})
