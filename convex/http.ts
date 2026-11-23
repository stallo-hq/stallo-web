import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { describeMessage, parseWebhook, verifyWebhookAuth } from './integrations/evolution'
import { verifyWebhook as verifyPaystack } from './integrations/paystack'

/**
 * Public webhook endpoints, at https://<deployment>.convex.site:
 *   POST /evolution/webhook   our Evolution API server (sellers' linked WhatsApp, ADR 0002)
 *   POST /paystack/webhook    Paystack
 * Both check who sent the request before acting on it, and fail closed when the
 * secret isn't set.
 */
const http = httpRouter()

http.route({
  path: '/evolution/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!(await verifyWebhookAuth(request.headers.get('authorization')))) {
      return new Response('Unauthorized', { status: 401 })
    }
    let payload: unknown
    try {
      payload = JSON.parse(await request.text())
    } catch {
      return new Response('Bad JSON', { status: 400 })
    }
    const event = parseWebhook(payload)
    switch (event.kind) {
      case 'message':
        if (event.fromMe) {
          // Typed by the seller on their own phone: human takeover for this chat.
          await ctx.runMutation(internal.inbound.sellerReplied, {
            instance: event.instance,
            echoes: [{ id: event.message.id, to: event.message.from, text: describeMessage(event.message).slice(0, 500) }],
          })
        } else {
          await ctx.runMutation(internal.inbound.receive, {
            instance: event.instance,
            messages: [{ id: event.message.id, from: event.message.from, profileName: event.profileName, raw: event.message }],
          })
        }
        break
      case 'connection':
        await ctx.runMutation(internal.whatsappConnect.onConnection, {
          instance: event.instance,
          state: event.state,
          ...(event.phone ? { phone: event.phone } : {}),
        })
        break
      case 'qr':
        await ctx.runMutation(internal.whatsappConnect.onQr, { instance: event.instance, qr: event.qr })
        break
      case 'ignore':
        break
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
