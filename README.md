# stallo-web

Stallo's marketing site, seller dashboard, and the Convex backend (`convex/`) that holds all of Stallo's data.

React 19 · TypeScript · Vite · React Router 7 · Radix UI primitives · Lucide icons · Convex · Convex Auth · SasuSync (SMS codes)

> MVP rules: `CLAUDE.md` in the workspace root. Team workflow: `stallo-hq/.github` → `HANDBOOK.md`.

## Getting started

```bash
npm install
npx convex dev      # first run: log in, create the project; writes .env.local. Leave it running.
npm run dev         # in a second terminal → http://localhost:5173
```

### Convex environment variables

Set these on the Convex deployment (`npx convex env set NAME value`, or in the Convex dashboard). Never put them in the frontend.

| Name | Needed for | Notes |
|---|---|---|
| `SASUSYNC_API_KEY` | SMS: sign-up codes, rider job links, seller alerts, delivery codes when WhatsApp can't be used | From the SasuSync portal (https://sms.sasusync.com) |
| `SASUSYNC_SENDER_ID` | Same | An approved sender ID, e.g. `Stallo` |
| `EVOLUTION_API_URL` | WhatsApp | Public HTTPS address of Stallo's Evolution API server. See `infra/evolution/README.md` |
| `EVOLUTION_API_KEY` | WhatsApp | Same value as `AUTHENTICATION_API_KEY` in `infra/evolution/.env` |
| `EVOLUTION_WEBHOOK_SECRET` | WhatsApp | Random, 32+ characters. Evolution signs every webhook with it; unsigned calls are rejected |
| `SMS_TEST_MODE` | Local development only | `true` = no SMS is sent and the code is always `123456`. **Never set in production.** |
| `SMS_HOURLY_LIMIT` | Optional | Max codes sent per hour across the whole service (default 300) |
| `PLATFORM_FEE_PERCENT` | Pricing | Stallo's fee per paid order, e.g. `2.5`. Shown on the website automatically |
| `PLATFORM_FEE_FLAT_PESEWAS` | Pricing | Optional flat fee per paid order, in pesewas (e.g. `50` = GH₵ 0.50) |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run convex` | Same as `npx convex dev` |
| `npm run build` | Type-check and production build |
| `npm run lint` | Lint (oxlint) |
| `npm test` | Unit tests (`src/lib`), Convex function tests (`convex/*.test.ts`, convex-test) and the SasuSync client against a mocked API |

## Layout

```
convex/                 Convex backend (owned by this repo)
  schema.ts             all tables (money in pesewas, phones in E.164)
  auth.ts               phone number + password sign-in (Convex Auth)
  account.ts            who am I, confirm phone, reset password
  phoneVerification.ts  send / check SMS codes (rate-limited)
  integrations/         third-party APIs (sasusync.ts)
  model/                shared rules: auth guard, validation, fees, verification tokens
  lib/                  code shared with the web app: validators, phone parsing, auth messages
  sellers.ts, products.ts, orders.ts, dashboard.ts, site.ts   thin public functions
src/
  app/                  router, account gate, dashboard shell, navigation
  components/ui/        Button, Field, Card, Badge, Dialog, Switch, Segmented, CodeInput, EmptyState …
  components/           Logo, PageHeader
  features/<area>/      pages, components and data hooks: landing, auth, overview, orders, products, settings
  hooks/                app-wide hooks (useSeller)
  lib/                  formatting and helpers: money, phone, dates, errors (one source each)
  styles/               design tokens and base styles
```

Rules of thumb:
- Pages never call Convex directly; they use their feature's hook (e.g. `useProducts`).
- Every seller-facing Convex function starts with `requireSeller` / `currentSeller`.
- Colours, radii and fonts only through `src/styles/tokens.css`. Status labels and colours live in one file per area (`orderStatus.ts`, `connectionStatus.ts`).

## Sign-up flow

1. Phone number → SasuSync sends a 6-digit code (`phoneVerification.sendCode`).
2. Code → checked by SasuSync (`verifyCode`), which returns a one-time token (stored hashed, valid 30 minutes).
3. Business name + password → account created, `account.confirmPhone(token)` marks the number verified, `sellers.create` sets up the business.

An account whose number isn't confirmed can't do anything; the dashboard asks it to confirm first. "Forgot password" uses the same code + token, then `account.resetPassword` sets the new password and signs out every other session.
