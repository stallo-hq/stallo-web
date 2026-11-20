import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation } from './_generated/server'
import { sendSms } from './integrations/sasusync'
import { raiseAttention } from './model/attention'

/**
 * Texts a delivery code to the person receiving an order placed by someone
 * else. If it can't be sent, the seller sees it in Needs attention; the buyer
 * already has the same code on WhatsApp.
 */
export const sendDeliveryCode = internalAction({
  args: { sellerId: v.id('sellers'), orderId: v.id('orders'), to: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    try {
      await sendSms(args.to, args.text)
    } catch (error) {
      console.error('Delivery code SMS failed:', error instanceof Error ? error.message : error)
      await ctx.runMutation(internal.sms.reportFailure, { sellerId: args.sellerId, orderId: args.orderId })
    }
    return null
  },
})

export const reportFailure = internalMutation({
  args: { sellerId: v.id('sellers'), orderId: v.id('orders') },
  returns: v.null(),
  handler: async (ctx, { sellerId, orderId }) => {
    await raiseAttention(ctx, {
      sellerId,
      orderId,
      type: 'message_failed',
      summary: 'The delivery code could not be texted to the receiver. The buyer has it on WhatsApp; ask them to pass it on, or call the receiver.',
      notify: true,
    })
    return null
  },
})
