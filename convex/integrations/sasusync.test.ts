import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SmsError, sendOtp, verifyOtp } from './sasusync'

/** Real-mode tests with SasuSync's HTTP API mocked, following https://sms.sasusync.com/docs/api. */

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))
}

beforeEach(() => {
  vi.stubEnv('SMS_TEST_MODE', 'false')
  vi.stubEnv('SASUSYNC_API_KEY', 'ss_test_key')
  vi.stubEnv('SASUSYNC_SENDER_ID', 'Stallo')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('sendOtp', () => {
  it('posts to /otp/generate with the key header and returns the otp_id', async () => {
    const fetch = respond(200, { success: true, otp_id: 4417, message: 'OTP sent' })
    vi.stubGlobal('fetch', fetch)

    expect(await sendOtp('+233241234567')).toBe('4417')

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://sms.sasusync.com/otp/generate')
    expect(init.headers).toMatchObject({ 'X-API-Key': 'ss_test_key', 'Content-Type': 'application/json' })
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ number: '233241234567', sender_id: 'Stallo', medium: 'sms', length: 6, expiry: 10 })
    expect(body.message).toContain('%otp_code%')
    expect(body.message.length).toBeLessThanOrEqual(160)
  })

  it('maps 429 to CODE_PENDING and 402 to OUT_OF_CREDIT', async () => {
    vi.stubGlobal('fetch', respond(429, { detail: 'pending' }))
    await expect(sendOtp('+233241234567')).rejects.toMatchObject({ code: 'CODE_PENDING' })
    vi.stubGlobal('fetch', respond(402, { detail: 'no credit' }))
    await expect(sendOtp('+233241234567')).rejects.toMatchObject({ code: 'OUT_OF_CREDIT' })
  })

  it('refuses to send without a key (fails closed)', async () => {
    vi.stubEnv('SASUSYNC_API_KEY', '')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(sendOtp('+233241234567')).rejects.toBeInstanceOf(SmsError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('treats a network failure as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')))
    await expect(sendOtp('+233241234567')).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })
})

describe('verifyOtp', () => {
  it('branches on `verified`, not the status code', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, verified: true, reason: 'verified' }))
    expect(await verifyOtp('+233241234567', '123456')).toBe('verified')

    vi.stubGlobal('fetch', respond(200, { success: true, verified: false, reason: 'wrong_code' }))
    expect(await verifyOtp('+233241234567', '000000')).toBe('wrong_code')

    vi.stubGlobal('fetch', respond(200, { success: true, verified: false, reason: 'expired' }))
    expect(await verifyOtp('+233241234567', '123456')).toBe('expired')
  })

  it('sends the number without the plus sign', async () => {
    const fetch = respond(200, { verified: true, reason: 'verified' })
    vi.stubGlobal('fetch', fetch)
    await verifyOtp('+233241234567', '123456')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ number: '233241234567', code: '123456' })
  })
})
