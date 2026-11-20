/**
 * Paystack API (https://paystack.com/docs/api). Server-side only.
 *
 * Env (Convex):
 *   PAYSTACK_SECRET_KEY          sk_test_... during development. Never a live key until launch.
 *   PAYSTACK_WEBHOOK_SECRET      optional whsec_... signing secret. When set, webhooks must carry the
 *                                newer Paystack-Signature header; otherwise x-paystack-signature is checked
 *                                with the secret key.
 *   PAYSTACK_CUSTOMER_EMAIL_DOMAIN  optional. Paystack needs an email per payment and WhatsApp customers
 *                                rarely give one, so Stallo uses <hash>@<this domain>. Default customers.stallo.app.
 *   SITE_URL                     where Paystack sends the customer after paying (/paid)
 */
import { hmacHex, safeEqualHex, sha256 } from '../model/crypto'

const BASE_URL = 'https://api.paystack.co'

export class PaystackError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500
  }
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new PaystackError(401, 'PAYSTACK_SECRET_KEY is not set')
  return key
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY)
}

async function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secretKey()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new PaystackError(0, 'Could not reach Paystack')
  }
  const json = (await response.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T }
  if (!response.ok || json.status !== true) {
    throw new PaystackError(response.status, json.message || `Paystack returned HTTP ${response.status}`)
  }
  return json.data as T
}

export type Bank = { name: string; code: string; type: string; active: boolean }

/** Ghana banks (type ghipss) or mobile money providers (type mobile_money). */
export async function listBanks(type: 'mobile_money' | 'ghipss'): Promise<{ name: string; code: string }[]> {
  const banks = await call<Bank[]>('GET', `/bank?country=ghana&currency=GHS&type=${type}&perPage=100`)
  return banks.filter((b) => b.active).map(({ name, code }) => ({ name, code }))
}

export type Subaccount = { subaccount_code: string; account_name?: string; settlement_bank?: string }

export async function createSubaccount(input: {
  businessName: string
  bankCode: string
  accountNumber: string
  phone: string
}): Promise<Subaccount> {
  // Stallo's fee is set per transaction (transaction_charge), so the default split is 0.
  return await call<Subaccount>('POST', '/subaccount', {
    business_name: input.businessName,
    bank_code: input.bankCode,
    settlement_bank: input.bankCode, // older name for the same field, still shown in Paystack's examples
    account_number: input.accountNumber,
    percentage_charge: 0,
    primary_contact_phone: input.phone,
  })
}

export async function updateSubaccount(
  code: string,
  input: { businessName: string; bankCode: string; accountNumber: string },
): Promise<Subaccount> {
  return await call<Subaccount>('PUT', `/subaccount/${encodeURIComponent(code)}`, {
    business_name: input.businessName,
    description: input.businessName,
    bank_code: input.bankCode,
    settlement_bank: input.bankCode,
    account_number: input.accountNumber,
  })
}

/** Paystack needs an email. Customers on WhatsApp don't give one, so use a stable one that reveals nothing. */
export async function customerEmail(phone: string): Promise<string> {
  const domain = process.env.PAYSTACK_CUSTOMER_EMAIL_DOMAIN || 'customers.stallo.app'
  return `c${(await sha256(phone)).slice(0, 16)}@${domain}`
}

/**
 * Starts a payment split between Stallo and the seller: the customer pays
 * `amountPesewas`, Stallo keeps `feePesewas`, the seller's subaccount gets the
 * rest and bears Paystack's own fee.
 */
export async function initializePayment(input: {
  amountPesewas: number
  feePesewas: number
  email: string
  reference: string
  subaccount: string
  metadata: Record<string, string>
}): Promise<{ authorization_url: string; reference: string }> {
  const site = process.env.SITE_URL?.replace(/\/$/, '')
  return await call('POST', '/transaction/initialize', {
    amount: String(input.amountPesewas),
    currency: 'GHS',
    email: input.email,
    reference: input.reference,
    channels: ['mobile_money', 'card'],
    subaccount: input.subaccount,
    transaction_charge: input.feePesewas,
    bearer: 'subaccount',
    metadata: JSON.stringify(input.metadata),
    ...(site ? { callback_url: `${site}/paid` } : {}),
  })
}

export type VerifiedTransaction = { status: string; reference: string; amount: number; currency: string }

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  return await call<VerifiedTransaction>('GET', `/transaction/verify/${encodeURIComponent(reference)}`)
}

export async function refund(reference: string): Promise<void> {
  await call('POST', '/refund', { transaction: reference })
}

// Webhooks (https://paystack.com/docs/payments/webhooks)

const TOLERANCE_SECONDS = 300

/**
 * Verifies a webhook. With PAYSTACK_WEBHOOK_SECRET set, requires the newer
 * `Paystack-Signature: t=<unix>,v1=<kid>:<hex>` (HMAC-SHA512 of "t." + body,
 * within 5 minutes). Otherwise checks `x-paystack-signature` (HMAC-SHA512 of the
 * body with the secret key). Fails closed when neither secret is set.
 */
export async function verifyWebhook(
  rawBody: string,
  headers: { signature: string | null; legacySignature: string | null },
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET
  if (webhookSecret) {
    const header = headers.signature
    if (!header) return false
    let t: number | null = null
    const signatures: string[] = []
    for (const part of header.split(',')) {
      const i = part.indexOf('=')
      if (i === -1) continue
      const key = part.slice(0, i).trim()
      const value = part.slice(i + 1).trim()
      if (key === 't') {
        if (t !== null || !/^\d+$/.test(value)) return false
        t = Number(value)
      } else if (key === 'v1') {
        const j = value.indexOf(':')
        if (j !== -1) signatures.push(value.slice(j + 1))
      }
    }
    if (t === null || signatures.length === 0 || Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) return false
    const expected = await hmacHex('SHA-512', webhookSecret, `${t}.${rawBody}`)
    return signatures.some((s) => /^[0-9a-f]{128}$/.test(s) && safeEqualHex(expected, s))
  }

  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key || !headers.legacySignature) return false
  return safeEqualHex(await hmacHex('SHA-512', key, rawBody), headers.legacySignature)
}
