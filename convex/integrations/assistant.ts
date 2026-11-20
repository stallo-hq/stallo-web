/**
 * Reads customer WhatsApp messages with Claude and returns structured intent.
 * The model only interprets; all prices, totals and order changes are decided
 * by our code from the seller's product list.
 *
 * Env (Convex):
 *   ANTHROPIC_API_KEY          Claude (preferred when set)
 *   GROQ_API_KEY, GROQ_MODEL   Groq fallback (default openai/gpt-oss-120b)
 *   LLM_MODEL                  default claude-haiku-5-5 (try claude-sonnet-5-5 if accuracy is poor)
 *   LLM_CONFIDENCE_THRESHOLD   default 0.75
 */
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod/v4'

export const Extraction = z.object({
  intent: z.enum(['order', 'confirm', 'cancel', 'question', 'greeting', 'other']),
  items: z
    .array(z.object({ product_id: z.string(), quantity: z.number().int() }))
    .nullable()
    .describe('The complete basket after this message, or null if the message does not change the basket.'),
  address: z.string().nullable().describe('Delivery address or landmark if the customer gave one in this message, else null.'),
  customer_name: z.string().nullable(),
  recipient_name: z
    .string()
    .nullable()
    .describe('If the order is for someone else: the name of the person receiving it, as given in this message. Else null.'),
  recipient_phone: z
    .string()
    .nullable()
    .describe('If the order is for someone else: their phone number as written in this message. Else null.'),
  outside_delivery_area: z
    .boolean()
    .nullable()
    .describe('Only when this message gives an address and the business lists delivery areas: true if the address is clearly outside them, false if inside or unsure. Else null.'),
  pay_with: z
    .enum(['online', 'cash'])
    .nullable()
    .describe('cash if the customer wants to pay the rider in cash on delivery; online if they say they will pay now by MoMo or card; else null.'),
  unmatched: z.array(z.string()).describe('Things the customer asked for that are not in the product list.'),
  reply: z
    .string()
    .nullable()
    .describe('For question, greeting or other: a short, friendly answer in plain English. Null for order, confirm and cancel.'),
  confidence: z.number().describe('0 to 1: how sure you are about intent, items and quantities.'),
})

export type Extraction = z.infer<typeof Extraction>

export type AssistantInput = {
  businessName: string
  products: { id: string; name: string; price: string; available: boolean }[]
  basket: { product_id: string; name: string; quantity: number }[]
  address: string | null
  recipient: string | null
  deliveryAreas: string | null
  awaitingConfirmation: boolean
  history: { from: 'customer' | 'stallo'; text: string }[]
  message: string
}

export const SYSTEM_PROMPT = `You read WhatsApp messages sent to a small business in Ghana and work out what the customer wants. A program uses your answer to build the order and reply, so be precise.

Customers write in English, Ghanaian Pidgin, Twi, or a mix, often with typos and abbreviations. Examples:
- "Pls I want 2 jollof and 1 sobolo" → order: 2 × the jollof product, 1 × the sobolo product.
- "Abeg add one more chicken" → order: the current basket with chicken quantity increased by 1.
- "Me pɛ waakye baako ne shito" → order: 1 waakye (and shito if it is a product).
- "Make am 3" right after they ordered jollof → order: jollof quantity 3.
- "Deliver to Madina, near the zongo junction" → order with address set, basket unchanged (items null).
- "Yes", "Yes please", "Ok go ahead", "Aane", "Confirm" while a confirmation is pending → confirm.
- "Cash", "I go pay cash", "Pay on delivery", "I'll pay the rider" while a confirmation is pending → confirm with pay_with "cash".
- "Cancel", "I no want again", "Mempɛ bio" → cancel.
- "How much be the fried rice?", "Do you deliver to Kasoa?" → question.
- "Hello", "Good morning" → greeting.
- "It's for my sister Ama, 024 123 4567, she's at Adenta" → order with address "Adenta", recipient_name "Ama", recipient_phone "024 123 4567", items null.
- "Deliver am give my mother, her number be 0551234567" → order with recipient_phone "0551234567", items null.

Rules:
- items is the whole basket after this message (existing basket plus changes), using product_id values from the product list only. Use null if the message does not change the basket.
- Never invent products or prices. If they ask for something not on the list, put it in unmatched.
- Quantities are whole numbers. "a", "one", "baako" = 1, "two", "mmienu" = 2, "three", "mmiɛnsa" = 3.
- address: only what the customer said in this message, copied as written.
- recipient_name and recipient_phone: only when the customer says the order goes to another person. Copy the number as written. Never use the customer's own name or number here.
- outside_delivery_area: compare the address with the business's delivery areas. Ghanaian place names and landmarks count; a nearby suburb of a listed area is inside. Say true only when you are confident it is outside. null when no address was given or no areas are listed.
- reply: only for question, greeting or other. Keep it to one or two short sentences, plain English, no emoji. You may quote prices from the product list. Never promise delivery times, discounts or anything not stated in the list. If you do not know, say the business will reply.
- confidence: lower it when the message is ambiguous, when you are guessing a product match, or when you cannot tell what they want. Use 0.9 or above only when it is clear.`

export function confidenceThreshold(): number {
  const value = Number(process.env.LLM_CONFIDENCE_THRESHOLD)
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : 0.75
}

export function model(): string {
  return process.env.LLM_MODEL || 'claude-haiku-5-5'
}

export function buildUserMessage(input: AssistantInput): string {
  const products = input.products.length
    ? input.products.map((p) => `- id=${p.id} | ${p.name} | ${p.price}${p.available ? '' : ' | NOT AVAILABLE'}`).join('\n')
    : '(no products yet)'
  const basket = input.basket.length ? input.basket.map((b) => `- id=${b.product_id} | ${b.name} × ${b.quantity}`).join('\n') : '(empty)'
  const history = input.history.length
    ? input.history.map((h) => `${h.from === 'customer' ? 'Customer' : 'Business'}: ${h.text}`).join('\n')
    : '(none)'
  return [
    `Business: ${input.businessName}`,
    `Products:\n${products}`,
    `Current basket:\n${basket}`,
    `Delivery address so far: ${input.address ?? '(none)'}`,
    `Receiver so far: ${input.recipient ?? 'the customer'}`,
    `Business delivers to: ${input.deliveryAreas ?? '(not stated)'}`,
    `Waiting for the customer to confirm the order: ${input.awaitingConfirmation ? 'yes' : 'no'}`,
    `Recent conversation:\n${history}`,
    `New message from the customer:\n${input.message}`,
  ].join('\n\n')
}

/** Clamps and cleans the model's answer so nothing out of range reaches the order logic. */
export function sanitize(raw: Extraction, productIds: ReadonlySet<string>): Extraction {
  const items =
    raw.items === null
      ? null
      : Object.values(
          raw.items
            .filter((i) => productIds.has(i.product_id) && Number.isFinite(i.quantity))
            .reduce<Record<string, { product_id: string; quantity: number }>>((acc, i) => {
              const quantity = Math.min(99, Math.max(0, Math.round(i.quantity)))
              acc[i.product_id] = { product_id: i.product_id, quantity }
              return acc
            }, {}),
        ).filter((i) => i.quantity > 0)
  const clean = (s: string | null, max: number) => (s && s.trim() ? s.trim().slice(0, max) : null)
  return {
    intent: raw.intent,
    items,
    address: clean(raw.address, 300),
    customer_name: clean(raw.customer_name, 80),
    recipient_name: clean(raw.recipient_name, 80),
    recipient_phone: clean(raw.recipient_phone, 30),
    outside_delivery_area: typeof raw.outside_delivery_area === 'boolean' ? raw.outside_delivery_area : null,
    pay_with: raw.pay_with === 'cash' || raw.pay_with === 'online' ? raw.pay_with : null,
    unmatched: raw.unmatched.map((u) => u.trim()).filter(Boolean).slice(0, 10),
    reply: clean(raw.reply, 600),
    confidence: Math.min(1, Math.max(0, Number.isFinite(raw.confidence) ? raw.confidence : 0)),
  }
}

export class AssistantError extends Error {}

/** True when any supported AI provider has a key. */
export function assistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY)
}

/**
 * Uses Claude when ANTHROPIC_API_KEY is set, otherwise Groq (GROQ_API_KEY,
 * model from GROQ_MODEL). Both return the same checked structure.
 */
export async function extract(input: AssistantInput): Promise<Extraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    if (process.env.GROQ_API_KEY) return extractWithGroq(input, process.env.GROQ_API_KEY)
    throw new AssistantError('ANTHROPIC_API_KEY (or GROQ_API_KEY) is not set')
  }
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 })

  const response = await client.messages.parse({
    model: model(),
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'low', format: zodOutputFormat(Extraction) },
    messages: [{ role: 'user', content: buildUserMessage(input) }],
  })

  if (response.stop_reason === 'refusal') throw new AssistantError('The assistant declined this message')
  if (!response.parsed_output) throw new AssistantError(`No structured answer (stop reason ${response.stop_reason})`)
  return sanitize(response.parsed_output, new Set(input.products.map((p) => p.id)))
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

async function extractWithGroq(input: AssistantInput, apiKey: string): Promise<Extraction> {
  const schema = JSON.stringify(z.toJSONSchema(Extraction))
  let response: Response
  try {
    response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\nAnswer with one JSON object only, matching this JSON Schema:\n${schema}` },
          { role: 'user', content: buildUserMessage(input) },
        ],
      }),
    })
  } catch {
    throw new AssistantError('Could not reach Groq')
  }
  const body = (await response.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string }
  }
  if (!response.ok) throw new AssistantError(`Groq: ${body.error?.message ?? `HTTP ${response.status}`}`)
  let parsed: unknown
  try {
    parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '')
  } catch {
    throw new AssistantError('Groq did not return JSON')
  }
  const result = Extraction.safeParse(parsed)
  if (!result.success) throw new AssistantError('Groq answer did not match the expected structure')
  return sanitize(result.data, new Set(input.products.map((p) => p.id)))
}
