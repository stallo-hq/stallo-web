/**
 * SasuSync SMS API (https://sms.sasusync.com/docs/api). Server-side only: the
 * key must never reach the browser.
 *
 * Env (Convex):
 *   SASUSYNC_API_KEY     required for real SMS
 *   SASUSYNC_SENDER_ID   an approved sender ID, e.g. "Stallo"
 *   SMS_TEST_MODE        "true" to skip SasuSync entirely; the code is always 123456.
 *                        For local development only. Never set it in production.
 */

const BASE_URL = 'https://sms.sasusync.com'
export const TEST_CODE = '123456'

export function smsTestMode(): boolean {
  return process.env.SMS_TEST_MODE === 'true'
}

type SmsErrorCode = 'NOT_CONFIGURED' | 'CODE_PENDING' | 'OUT_OF_CREDIT' | 'REJECTED' | 'UNAVAILABLE'

export class SmsError extends Error {
  readonly code: SmsErrorCode
  constructor(code: SmsErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

function config() {
  const apiKey = process.env.SASUSYNC_API_KEY
  const senderId = process.env.SASUSYNC_SENDER_ID
  if (!apiKey || !senderId) {
    throw new SmsError('NOT_CONFIGURED', 'SMS is not set up: SASUSYNC_API_KEY and SASUSYNC_SENDER_ID are required.')
  }
  return { apiKey, senderId }
}

/** SasuSync accepts 233XXXXXXXXX. */
function toSasuSyncNumber(e164: string): string {
  return e164.replace(/^\+/, '')
}

async function post(path: string, body: unknown, apiKey: string): Promise<{ status: number; data: Record<string, unknown> }> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new SmsError('UNAVAILABLE', 'Could not reach the SMS service.')
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return { status: response.status, data }
}

function failure(status: number, data: Record<string, unknown>): SmsError {
  const detail = typeof data.detail === 'string' ? data.detail : `HTTP ${status}`
  if (status === 429) return new SmsError('CODE_PENDING', detail)
  if (status === 402) return new SmsError('OUT_OF_CREDIT', detail)
  if (status === 401 || status === 403) return new SmsError('NOT_CONFIGURED', detail)
  if (status >= 500) return new SmsError('UNAVAILABLE', detail)
  return new SmsError('REJECTED', detail)
}

/** Sends a 6-digit code that expires in 10 minutes. Returns SasuSync's otp_id. */
export async function sendOtp(phone: string): Promise<string> {
  if (smsTestMode()) return 'test'
  const { apiKey, senderId } = config()
  const { status, data } = await post(
    '/otp/generate',
    {
      number: toSasuSyncNumber(phone),
      sender_id: senderId,
      message: 'Your Stallo code is %otp_code%. It expires in 10 minutes. Do not share it with anyone.',
      medium: 'sms',
      otp_type: 'numeric',
      expiry: 10,
      length: 6,
    },
    apiKey,
  )
  if (status >= 200 && status < 300 && data.success === true) return String(data.otp_id)
  throw failure(status, data)
}

export type OtpCheck = 'verified' | 'wrong_code' | 'expired' | 'no_pending_code' | 'already_verified'

/** Checks a code. A wrong code is an answer, not an error. */
export async function verifyOtp(phone: string, code: string): Promise<OtpCheck> {
  if (smsTestMode()) return code === TEST_CODE ? 'verified' : 'wrong_code'
  const { apiKey } = config()
  const { status, data } = await post('/otp/verify', { number: toSasuSyncNumber(phone), code }, apiKey)
  if (status >= 200 && status < 300) {
    if (data.verified === true) return 'verified'
    const reason = data.reason
    if (reason === 'expired' || reason === 'no_pending_code' || reason === 'already_verified') return reason
    return 'wrong_code'
  }
  throw failure(status, data)
}
