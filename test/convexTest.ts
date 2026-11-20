/// <reference types="vite/client" />
import { registerCore, sessionIdentity } from '@convex-dev/auth/test'
import { registerUsername } from '@convex-dev/auth/components/username/test'
import { convexTest } from 'convex-test'
import { vi } from 'vitest'
import { api, components } from '../convex/_generated/api'
import schema from '../convex/schema'

/** Shared setup for Convex function tests (convex-test, in-memory). */

const modules = import.meta.glob('../convex/**/*.ts')

export function setup() {
  const t = convexTest(schema, modules)
  registerCore(t)
  registerUsername(t)
  return t
}

export type T = ReturnType<typeof setup>

const TTL = { accessTokenTtlSeconds: 3600, refreshInactivityTimeoutSeconds: 86400, sessionMaxLifetimeSeconds: 86400 }

/**
 * A signed-in account that hasn't confirmed its phone yet. Does what password
 * sign-up does once the password is checked (the password hashing itself
 * doesn't run under vitest): create the user, store the phone number as the
 * username, open a real session.
 */
export async function account(t: T, phone: string) {
  const userId = await t.run((ctx) => ctx.db.insert('users', { createdAt: Date.now() }))
  await t.mutation(components.authUsername.public.setUsername, { userId, username: phone })
  const tokens = await t.mutation(components.auth.public._internal_dangerous_signIn, {
    claims: { method: 'usernamePassword', profile: {} },
    componentPath: 'authUsername',
    userId,
    ...TTL,
  })
  return t.withIdentity(sessionIdentity(tokens))
}

/** A token proving we hold the phone, from the real SMS-code actions (SMS_TEST_MODE: code 123456). */
export async function phoneToken(t: T, phone: string) {
  await t.action(api.phoneVerification.sendCode, { phone })
  return (await t.action(api.phoneVerification.verifyCode, { phone, code: '123456' })).token
}

/** A fully set-up seller: account, confirmed phone, business. */
export async function seller(t: T, phone: string, businessName: string) {
  const as = await account(t, phone)
  await as.mutation(api.account.confirmPhone, { token: await phoneToken(t, phone) })
  await as.mutation(api.sellers.create, { businessName })
  return as
}

type Handler = (url: URL, init: RequestInit | undefined) => unknown | Promise<unknown>

/**
 * Replaces fetch with a router keyed by host + path prefix. Each handler returns
 * a JSON body (status 200) or a Response. Records every call.
 */
export function mockFetch(routes: Record<string, Handler>) {
  const calls: { url: string; body: unknown }[] = []
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url: url.href, body })
    const key = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((k) => `${url.host}${url.pathname}`.startsWith(k))
    if (!key) throw new Error(`Unexpected fetch: ${url.href}`)
    const result = await routes[key](url, init)
    return result instanceof Response
      ? result
      : new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetch)
  return calls
}

/** A Claude Messages API response whose text is the given structured answer. */
export function claudeAnswer(answer: unknown) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [{ type: 'text', text: JSON.stringify(answer) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  }
}
