# stallo-web

Seller dashboard for **Stallo**, plus the Convex backend (`convex/`) that holds all of Stallo's data.

React 19 · TypeScript · Vite · Ionic React (iOS mode) · React Router 6 · Convex · Convex Auth

> Team roles and workflow: `stallo-hq/.github` → `HANDBOOK.md`. MVP rules: `CLAUDE.md` in the workspace root.

## Getting started

```bash
npm install
npx convex dev      # first run: log in, create the project; writes .env.local. Leave it running.
npm run dev         # in a second terminal → http://localhost:5173
```

`npx convex dev` watches `convex/`, pushes changes to your dev deployment and regenerates `convex/_generated/`.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run convex` | Same as `npx convex dev` |
| `npm run build` | Type-check and production build |
| `npm run lint` | Lint (oxlint) |

## Layout

```
convex/           Convex backend: schema, auth, functions (owned by this repo)
  schema.ts       all tables (money in pesewas, phones in E.164)
  auth.ts         phone number + password sign-in (Convex Auth)
  lib/            shared validators (order/payment status values)
src/
  app/            App (auth gate) and Tabs (Today, Orders, Products, Settings)
  components/     LargeTitlePage, EmptyState
  features/       one folder per area: auth, today, orders, products, settings
  lib/            haptics, phone formatting
  theme/          iOS text styles (typography.css) and layout helpers
```

## Design rules

The UI follows Apple's Human Interface Guidelines using Ionic's own components in iOS mode. Use Ionic components only (no Tailwind, shadcn or other kits), Ionicons for icons, Ionic colour variables (no hex values), and the text classes in `src/theme/typography.css`. See `CLAUDE.md` §6.

## Sign-in

Sellers sign in with their Ghana mobile number and a password (at least 10 characters). The number is stored as `+233XXXXXXXXX` and is the account's username.

## Known issue

`npm audit` reports moderate advisories in React Router 6 (open redirect in `<Link>`/`navigate` with untrusted input; SSR hydration). Ionic React Router 9 requires React Router 6, and this app never navigates to user-supplied URLs and does no SSR. Revisit when Ionic supports React Router 7.
