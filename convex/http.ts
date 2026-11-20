import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { verifyWebhook as verifyPaystack } from './integrations/paystack'
import { parseWebhook, verifyWebhookSignature } from './integrations/whatsapp'

/**
 * Public webhook endpoints, at https://<deployment>.convex.site:
 *   GET/POST /whatsapp/webhook   Meta WhatsApp Cloud API
 *   POST     /paystack/webhook   Paystack
 * Both verify signatures on the raw body and fail closed when the secret isn't set.
 */
const http = httpRouter()

http.route({
  path: '/whatsapp/webhook',
  method: 'GET',
  handler: httpAction(async (_ctx, request) => {
    const params = new URL(request.url).searchParams
    const expected = process.env.WHATSAPP_VERIFY_TOKEN
    if (expected && params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === expected) {
      return new Response(params.get('hub.challenge') ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }),
})

http.route({
  path: '/whatsapp/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const raw = await request.text()
    if (!(await verifyWebhookSignature(raw, request.headers.get('x-hub-signature-256')))) {
      return new Response('Invalid signature', { status: 401 })
    }
    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      return new Response('Bad JSON', { status: 400 })
    }
    for (const batch of parseWebhook(payload)) {
      if (batch.messages.length > 0) {
        await ctx.runMutation(internal.inbound.receive, {
          phoneNumberId: batch.phoneNumberId,
          messages: batch.messages.map((m) => ({
            id: m.id,
            from: m.from,
            profileName: batch.contacts.get(m.from),
            raw: m,
          })),
        })
      }
      for (const status of batch.statuses) {
        if (status.status !== 'failed') continue
        const error = status.errors?.[0]
        await ctx.runMutation(internal.outbound.markFailedByWhatsAppId, {
          whatsappMessageId: status.id,
          error: error ? `${error.title ?? error.message ?? 'Failed'} (${error.code})` : 'Failed',
        })
      }
    }
    return new Response('OK', { status: 200 })
  }),
})

http.route({
  path: '/paystack/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const raw = await request.text()
    const valid = await verifyPaystack(raw, {
      signature: request.headers.get('paystack-signature'),
      legacySignature: request.headers.get('x-paystack-signature'),
    })
    if (!valid) return new Response('Invalid signature', { status: 401 })

    let event: { event?: string; data?: Record<string, unknown> }
    try {
      event = JSON.parse(raw)
    } catch {
      return new Response('Bad JSON', { status: 400 })
    }
    const data = event.data ?? {}
    if (event.event === 'charge.success' && typeof data.reference === 'string') {
      await ctx.scheduler.runAfter(0, internal.payments.handleChargeSuccess, { reference: data.reference })
    } else if (event.event === 'refund.failed') {
      const transaction = data.transaction as { reference?: string } | undefined
      const reference = (data.transaction_reference as string | undefined) ?? transaction?.reference
      if (typeof reference === 'string') await ctx.runMutation(internal.payments.handleRefundFailed, { reference })
    }
    return new Response('OK', { status: 200 })
  }),
})

export default http
