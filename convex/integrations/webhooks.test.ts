import { afterEach, describe, expect, it, vi } from 'vitest'
import { hmacHex } from '../model/crypto'
import { verifyWebhook } from './paystack'
import { messageText, parseWebhook, verifyWebhookSignature } from './whatsapp'

afterEach(() => vi.unstubAllEnvs())

const body = JSON.stringify({ event: 'charge.success', data: { reference: 'STL-1001-1' } })

describe('WhatsApp webhook signature', () => {
  it('accepts a correct signature', async () => {
    vi.stubEnv('WHATSAPP_APP_SECRET', 'app-secret')
    const sig = `sha256=${await hmacHex('SHA-256', 'app-secret', body)}`
    expect(await verifyWebhookSignature(body, sig)).toBe(true)
  })

  it('rejects a wrong, missing or mismatched signature', async () => {
    vi.stubEnv('WHATSAPP_APP_SECRET', 'app-secret')
    const good = `sha256=${await hmacHex('SHA-256', 'app-secret', body)}`
    expect(await verifyWebhookSignature(body, `sha256=${await hmacHex('SHA-256', 'other', body)}`)).toBe(false)
    expect(await verifyWebhookSignature(body, null)).toBe(false)
    expect(await verifyWebhookSignature(`${body} `, good)).toBe(false)
  })

  it('rejects everything when the secret is not configured', async () => {
    vi.stubEnv('WHATSAPP_APP_SECRET', '')
    const sig = `sha256=${await hmacHex('SHA-256', 'x', body)}`
    expect(await verifyWebhookSignature(body, sig)).toBe(false)
  })
})

describe('WhatsApp webhook payload', () => {
  it('pulls out messages, names and failed statuses', () => {
    const batches = parseWebhook({
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '111' },
                contacts: [{ wa_id: '233241234567', profile: { name: 'Kofi' } }],
                messages: [{ id: 'wamid.1', from: '233241234567', type: 'text', text: { body: 'Hi' } }],
                statuses: [{ id: 'wamid.out', status: 'failed', errors: [{ code: 131047 }] }],
              },
            },
          ],
        },
      ],
    })
    expect(batches).toHaveLength(1)
    expect(batches[0].phoneNumberId).toBe('111')
    expect(batches[0].contacts.get('233241234567')).toBe('Kofi')
    expect(messageText(batches[0].messages[0])).toBe('Hi')
    expect(batches[0].statuses[0].status).toBe('failed')
  })

  it('ignores other fields and junk', () => {
    expect(parseWebhook({ entry: [{ changes: [{ field: 'account_update', value: {} }] }] })).toEqual([])
    expect(parseWebhook(null)).toEqual([])
  })
})

describe('Paystack webhook signature', () => {
  it('checks x-paystack-signature with the secret key', async () => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_x')
    vi.stubEnv('PAYSTACK_WEBHOOK_SECRET', '')
    const good = await hmacHex('SHA-512', 'sk_test_x', body)
    const bad = (good.endsWith('0') ? good.slice(0, -1) + '1' : good.slice(0, -1) + '0')
    expect(await verifyWebhook(body, { signature: null, legacySignature: good })).toBe(true)
    expect(await verifyWebhook(body, { signature: null, legacySignature: bad })).toBe(false)
  })

  it('checks the newer Paystack-Signature header, with a 5-minute window', async () => {
    vi.stubEnv('PAYSTACK_WEBHOOK_SECRET', 'whsec_abc')
    const t = 1_760_270_400
    const sig = await hmacHex('SHA-512', 'whsec_abc', `${t}.${body}`)
    const header = `t=${t},v1=whk_old:${'0'.repeat(128)},v1=whk_new:${sig}`
    expect(await verifyWebhook(body, { signature: header, legacySignature: null }, t + 10)).toBe(true)
    expect(await verifyWebhook(body, { signature: header, legacySignature: null }, t + 301)).toBe(false)
    // Once a signing secret is set, the older header alone is not enough.
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_x')
    const legacy = await hmacHex('SHA-512', 'sk_test_x', body)
    expect(await verifyWebhook(body, { signature: null, legacySignature: legacy }, t)).toBe(false)
  })

  it('rejects everything when no secret is configured', async () => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', '')
    vi.stubEnv('PAYSTACK_WEBHOOK_SECRET', '')
    expect(await verifyWebhook(body, { signature: null, legacySignature: await hmacHex('SHA-512', 'x', body) })).toBe(false)
  })
})
