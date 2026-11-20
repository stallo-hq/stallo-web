import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

/** Called by Convex Auth when a new account signs up. */
export const createUser = internalMutation({
  args: {
    method: v.object({ name: v.literal('usernamePassword'), profile: v.object({}) }),
  },
  returns: v.id('users'),
  handler: async (ctx) => {
    return await ctx.db.insert('users', { createdAt: Date.now() })
  },
})
