/**
 * Hugging Face Inference (hf-inference provider): sentence embeddings, used to
 * find the products a customer's message is most likely about. Server-side only.
 *
 * Env (Convex):
 *   HUGGINGFACE_API_KEY       a read-only token with "Make calls to Inference Providers"
 *   HUGGINGFACE_EMBED_MODEL   optional; must give EMBEDDING_DIMENSIONS-long vectors
 *                             (default sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2)
 */

export const EMBEDDING_DIMENSIONS = 384
const DEFAULT_MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
const TIMEOUT_MS = 15_000
const MAX_INPUT_CHARS = 1000

export type HuggingFaceErrorKind = 'not_configured' | 'temporary' | 'rejected'

export class HuggingFaceError extends Error {
  readonly kind: HuggingFaceErrorKind
  constructor(kind: HuggingFaceErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export function huggingfaceConfigured(): boolean {
  return Boolean(process.env.HUGGINGFACE_API_KEY)
}

export function embeddingModel(): string {
  return process.env.HUGGINGFACE_EMBED_MODEL || DEFAULT_MODEL
}

/** Scales a vector to length 1, so a dot product is the cosine similarity. */
export function normalise(vector: number[]): number[] {
  const length = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0))
  return length > 0 ? vector.map((x) => x / length) : vector
}

/** One vector per input. Accepts pooled output ([n][d]) or token output ([n][tokens][d], mean-pooled here). */
export function parseEmbeddings(body: unknown, count: number): number[][] {
  if (!Array.isArray(body) || body.length !== count) throw new HuggingFaceError('rejected', 'Unexpected embedding response')
  return body.map((item) => {
    let vector: unknown = item
    if (Array.isArray(item) && Array.isArray(item[0])) {
      const tokens = item as number[][]
      vector = tokens[0].map((_, i) => tokens.reduce((sum, t) => sum + t[i], 0) / tokens.length)
    }
    if (!Array.isArray(vector) || !vector.every((x) => typeof x === 'number' && Number.isFinite(x))) {
      throw new HuggingFaceError('rejected', 'Unexpected embedding response')
    }
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new HuggingFaceError('rejected', `${embeddingModel()} gives ${vector.length}-long vectors; Stallo needs ${EMBEDDING_DIMENSIONS}`)
    }
    return normalise(vector as number[])
  })
}

/** Embeds up to 32 short texts in one call. */
export async function embed(texts: string[]): Promise<number[][]> {
  const key = process.env.HUGGINGFACE_API_KEY
  if (!key) throw new HuggingFaceError('not_configured', 'HUGGINGFACE_API_KEY is not set')
  if (texts.length === 0) return []
  if (texts.length > 32) throw new HuggingFaceError('rejected', 'Embed at most 32 texts per call')
  const model = embeddingModel()
  let response: Response
  try {
    response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: texts.map((t) => t.slice(0, MAX_INPUT_CHARS)) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new HuggingFaceError('temporary', 'Could not reach Hugging Face')
  }
  const body = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    const detail = typeof (body as { error?: unknown })?.error === 'string' ? (body as { error: string }).error : `HTTP ${response.status}`
    if (response.status === 401 || response.status === 403) throw new HuggingFaceError('not_configured', 'Hugging Face rejected the API key')
    // 503: the model is loading; 429: rate limited.
    if (response.status === 429 || response.status >= 500) throw new HuggingFaceError('temporary', detail)
    throw new HuggingFaceError('rejected', detail)
  }
  return parseEmbeddings(body, texts.length)
}
