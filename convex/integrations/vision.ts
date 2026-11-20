/**
 * Looks at pictures: describes a seller's product photo once, and matches a
 * customer's picture (e.g. a TikTok screenshot) against the seller's products.
 * Uses Claude when ANTHROPIC_API_KEY is set, otherwise Groq (GROQ_API_KEY).
 *
 * Env (Convex):
 *   GROQ_VISION_MODEL   default meta-llama/llama-4-scout-17b-16e-instruct
 *   LLM_MODEL           Claude model when using Anthropic (default claude-haiku-5-5)
 */
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod/v4'
import { model as claudeModel } from './assistant'

export class VisionError extends Error {}

export type Picture = { bytes: Uint8Array; mimeType: string }

/** Groq takes images up to 4 MB as base64; keep well under that. */
const MAX_PICTURE_BYTES = 3 * 1024 * 1024
const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function visionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY)
}

export const PictureMatch = z.object({
  description: z.string().describe('One short sentence: what the picture shows.'),
  text_in_image: z.string().nullable().describe('Any product name, price or words visible in the picture, else null.'),
  matches: z
    .array(z.object({ product_id: z.string(), confidence: z.number() }))
    .describe('Products from the list this could be, best first, at most 3. Empty if none fit.'),
})
export type PictureMatch = z.infer<typeof PictureMatch>

export type CatalogueItem = { id: string; name: string; price: string; photo: string | null }

const DESCRIBE_PROMPT =
  'This is a photo of a product a small business in Ghana sells. In one or two sentences, describe what the item is and how it looks: type of item, main colours, patterns, materials, size or packaging, anything distinctive. Plain text only.'

const MATCH_PROMPT = `A customer of a small business in Ghana sent this picture on WhatsApp, often a screenshot from TikTok, Instagram or a status, to ask if the business has it.

Work out which of the business's products it shows. Each product has a name and, when available, a description of its photo. Compare the type of item first, then colours, patterns and other details. Read any text in the picture (names, prices) and use it.

Rules:
- Only use product ids from the list.
- confidence 0 to 1. Use 0.85 or above only when the picture clearly shows that exact product. Similar items of the same type but a different colour or pattern get 0.5 or less.
- If nothing in the list fits, return an empty matches array.
- Answer with one JSON object only: {"description": string, "text_in_image": string|null, "matches": [{"product_id": string, "confidence": number}]}`

function catalogueText(products: CatalogueItem[], caption: string | null): string {
  const list = products.length
    ? products.map((p) => `- id=${p.id} | ${p.name} | ${p.price}${p.photo ? ` | photo: ${p.photo}` : ''}`).join('\n')
    : '(no products)'
  return `Products:\n${list}\n\nCustomer's message with the picture: ${caption?.trim() || '(none)'}`
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

function checkPicture(picture: Picture): string {
  const mimeType = picture.mimeType.split(';')[0].trim().toLowerCase()
  if (!SUPPORTED.has(mimeType)) throw new VisionError(`Unsupported picture type ${mimeType}`)
  if (picture.bytes.length > MAX_PICTURE_BYTES) throw new VisionError('Picture is too large to read')
  return mimeType
}

/** Calls the configured provider with one picture and a prompt; returns the text answer. */
async function ask(picture: Picture, system: string, text: string, json: boolean): Promise<string> {
  const mimeType = checkPicture(picture)
  const data = base64(picture.bytes)

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    const client = new Anthropic({ apiKey: anthropicKey, maxRetries: 2, timeout: 60_000 })
    const response = await client.messages.create({
      model: claudeModel(),
      max_tokens: 1000,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/jpeg', data } },
            { type: 'text', text },
          ],
        },
      ],
    })
    if (response.stop_reason === 'refusal') throw new VisionError('The assistant declined this picture')
    return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  }

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) throw new VisionError('ANTHROPIC_API_KEY or GROQ_API_KEY is not set')
  let response: Response
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
        temperature: 0,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } },
            ],
          },
        ],
      }),
    })
  } catch {
    throw new VisionError('Could not reach Groq')
  }
  const body = (await response.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
  if (!response.ok) throw new VisionError(`Groq: ${body.error?.message ?? `HTTP ${response.status}`}`)
  return body.choices?.[0]?.message?.content ?? ''
}

/** A short description of a seller's product photo. */
export async function describeProductPhoto(picture: Picture, productName: string): Promise<string> {
  const text = await ask(picture, DESCRIBE_PROMPT, `Product name: ${productName}`, false)
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 400)
  if (!clean) throw new VisionError('No description returned')
  return clean
}

/** Which of the seller's products a customer's picture shows. */
export async function matchPicture(picture: Picture, products: CatalogueItem[], caption: string | null): Promise<PictureMatch> {
  const raw = await ask(picture, MATCH_PROMPT, catalogueText(products, caption), true)
  const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new VisionError('The picture answer was not JSON')
  }
  const result = PictureMatch.safeParse(parsed)
  if (!result.success) throw new VisionError('The picture answer did not match the expected structure')
  return sanitizeMatch(result.data, new Set(products.map((p) => p.id)))
}

/** Keeps only real product ids, once each, best first, at most 3, confidence in 0..1. */
export function sanitizeMatch(raw: PictureMatch, productIds: ReadonlySet<string>): PictureMatch {
  const seen = new Set<string>()
  const matches = raw.matches
    .filter((m) => productIds.has(m.product_id) && Number.isFinite(m.confidence))
    .map((m) => ({ product_id: m.product_id, confidence: Math.min(1, Math.max(0, m.confidence)) }))
    .sort((a, b) => b.confidence - a.confidence)
    .filter((m) => (seen.has(m.product_id) ? false : (seen.add(m.product_id), true)))
    .slice(0, 3)
  return {
    description: raw.description.trim().slice(0, 300),
    text_in_image: raw.text_in_image?.trim().slice(0, 300) || null,
    matches,
  }
}

/** How sure the top match has to be, and how far ahead of the next, to add it to the basket. */
export const CLEAR_MATCH = { min: 0.8, lead: 0.2 }
/** Below this, a product isn't offered as a suggestion. */
export const SUGGEST_MIN = 0.4

export type PictureDecision =
  | { kind: 'match'; productId: string }
  | { kind: 'choose'; productIds: string[] }
  | { kind: 'none' }

export function decide(match: PictureMatch): PictureDecision {
  const [first, second] = match.matches
  if (first && first.confidence >= CLEAR_MATCH.min && (!second || first.confidence - second.confidence >= CLEAR_MATCH.lead)) {
    return { kind: 'match', productId: first.product_id }
  }
  const options = match.matches.filter((m) => m.confidence >= SUGGEST_MIN).map((m) => m.product_id)
  return options.length > 0 ? { kind: 'choose', productIds: options } : { kind: 'none' }
}
