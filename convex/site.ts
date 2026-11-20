import { v } from 'convex/values'
import { query } from './_generated/server'
import { feeConfig } from './model/fees'

/** Public: the current fee, so the marketing site always shows the real price. */
export const pricing = query({
  args: {},
  returns: v.object({ percent: v.number(), flatPesewas: v.number(), capPesewas: v.optional(v.number()) }),
  handler: async () => feeConfig(),
})

/** Public: true while SMS_TEST_MODE is on, so sign-up can show the test code instead of leaving people stuck. */
export const smsTestMode = query({
  args: {},
  returns: v.boolean(),
  handler: async () => process.env.SMS_TEST_MODE === 'true',
})

/**
 * Public: which integrations are switched on, so the dashboard shows the right
 * next step. Only non-secret values (Meta's app and configuration ids are meant
 * to be public: the browser needs them to open the signup popup).
 */
export const integrations = query({
  args: {},
  returns: v.object({
    embeddedSignup: v.union(v.null(), v.object({ appId: v.string(), configId: v.string(), graphVersion: v.string() })),
    manualWhatsApp: v.boolean(),
    payments: v.boolean(),
    assistant: v.boolean(),
  }),
  handler: async () => {
    const appId = process.env.META_APP_ID
    const configId = process.env.WHATSAPP_CONFIG_ID
    return {
      embeddedSignup: appId && configId ? { appId, configId, graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v27.0' } : null,
      manualWhatsApp: process.env.WHATSAPP_MANUAL_CONNECT === 'true',
      payments: Boolean(process.env.PAYSTACK_SECRET_KEY),
      assistant: Boolean(process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY),
    }
  },
})
