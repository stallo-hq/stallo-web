import { v } from 'convex/values'
import { query } from './_generated/server'
import { evolutionConfigured } from './integrations/evolution'
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
 * next step. Only yes/no answers, never secrets.
 */
export const integrations = query({
  args: {},
  returns: v.object({
    whatsapp: v.boolean(),
    payments: v.boolean(),
    assistant: v.boolean(),
  }),
  handler: async () => {
    return {
      whatsapp: evolutionConfigured(),
      payments: Boolean(process.env.PAYSTACK_SECRET_KEY),
      assistant: Boolean(process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY),
    }
  },
})
