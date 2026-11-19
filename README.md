# stallo-web

Seller dashboard for **Stallo**: orders, inventory, payments, daily summaries, and the "needs attention" queue for anything the system couldn't handle on its own.

React 19 · TypeScript · Vite · React Router · TanStack Query

> Team roles, workflow and conventions live in the org handbook: `stallo-hq/.github` → `HANDBOOK.md`.

## Getting started

```bash
cp .env.example .env      # points at the API, default http://localhost:8000
npm install
npm run dev               # http://localhost:5173
```

> `package-lock.json` isn't committed yet. Whoever runs the first `npm install` commits the generated lock file in their first PR, and CI is then switched back to `npm ci` with npm caching.

You need `stallo-api` running for real data. See its README.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and production build |
| `npm run lint` | Lint (oxlint) |
| `npm run gen:api` | Regenerate `src/lib/api-types.ts` from the running API's OpenAPI schema |

## Layout

```
src/
  app/            providers (React Query) and the router. Shared; changes need a lead review
  components/     shared UI: layout, buttons, tables, etc.
  features/       one folder per area; each owns its pages, components and hooks
    auth/  dashboard/  orders/  inventory/  payments/  exceptions/  settings/
  lib/            api client and generated API types
```

## Conventions

- **Features own their code.** Put a feature's components, hooks (`useOrders.ts`) and types inside its folder. Move something to `components/` only once a second feature needs it.
- **Server data goes through TanStack Query** with hooks like `useOrders()`, `useCreateProduct()`. Don't keep API data in `useState`.
- **Use the generated API types** from `npm run gen:api` instead of writing response types by hand. When the backend changes a schema, regenerate the types and commit them in the same PR.
- **Don't hardcode URLs.** Everything goes through `src/lib/api.ts`, with the base URL taken from `VITE_API_URL`.
