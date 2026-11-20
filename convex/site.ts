import { v } from 'convex/values'
import { query } from './_generated/server'
import { feeConfig } from './model/fees'

/** Public: the current fee, so the marketing site always shows the real price. */
export const pricing = query({
  args: {},
  returns: v.object({ percent: v.number(), flatPesewas: v.number() }),
  handler: async () => feeConfig(),
})

/** Public: true while SMS_TEST_MODE is on, so sign-up can show the test code instead of leaving people stuck. */
export const smsTestMode = query({
  args: {},
  returns: v.boolean(),
  handler: async () => process.env.SMS_TEST_MODE === 'true',
})
