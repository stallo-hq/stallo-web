# Evolution API (Stallo's WhatsApp gateway)

Sellers link their own WhatsApp or WhatsApp Business number to Stallo by scanning a QR code, the same way they link WhatsApp Web. Each seller gets one session on this server. Background and risks: `docs/decisions/0002-evolution-api.md`.

Convex talks to this server; the browser never does.

```
seller's phone ──linked device── Evolution API (this folder) ──webhook (signed)──► Convex /evolution/webhook
                                        ▲
                                        └── Convex actions (apikey header): QR codes, send, read receipts
```

## Requirements

- A machine that stays on, with Docker and about 1 GB of free memory. Sessions are kept in Postgres and survive restarts, but while the server is down Stallo can't read or reply.
- A public HTTPS address for it. Convex must reach it, and Evolution must reach Convex.

**Recommended, free, nothing on your laptop:** Oracle Cloud Always Free server + Neon database, step by step in [ORACLE.md](ORACLE.md) (`docker-compose.neon.yml`, `setup-server.sh`).

There is no completely free managed host that fits: Render's and Vercel's free tiers sleep or have no disk. Options that cost nothing:

- an always-free cloud VM (for example Oracle Cloud's Always Free tier), or
- a spare computer or mini PC that stays on, with a free **Cloudflare Tunnel** for HTTPS (no open ports, no static IP).

## Set up

1. Copy `.env.example` to `.env` and fill in `POSTGRES_PASSWORD`, `AUTHENTICATION_API_KEY` and `SERVER_URL`. Use long random values (`openssl rand -hex 32`).
2. Start it:
   ```
   docker compose up -d
   docker compose logs -f evolution
   ```
3. Give it HTTPS. With Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:8080` for a quick test URL, or a named tunnel for a fixed hostname. Put that URL in `SERVER_URL` and restart.
4. Check it answers: `curl -H "apikey: <AUTHENTICATION_API_KEY>" https://<your-host>/instance/fetchInstances` returns `[]`.
5. In `frontend/`, set the Convex variables (names only here; values from steps 1 and 3):
   ```
   npx convex env set EVOLUTION_API_URL https://<your-host>
   npx convex env set EVOLUTION_API_KEY <AUTHENTICATION_API_KEY>
   npx convex env set EVOLUTION_WEBHOOK_SECRET <a new random value, 32+ characters>
   ```
   Stallo registers each seller's webhook itself (`https://<deployment>.convex.site/evolution/webhook`) and asks Evolution to sign every call with `EVOLUTION_WEBHOOK_SECRET`. Calls without a valid signature are rejected.
6. In the dashboard: Settings > WhatsApp > Show QR code, and scan it from the phone.

## Operating notes

- **Upgrades:** the image is pinned. Read the Evolution changelog and run the test suite's fakes against a test number before changing the tag.
- **Backups:** back up the `evolution_postgres` volume. Losing it unlinks every seller; they would have to scan again.
- **Stored data:** Evolution keeps new messages in its database so Stallo can fetch pictures. Contacts, chats and history are not saved (see `.env.example`).
- **Rotating secrets:** after changing `EVOLUTION_WEBHOOK_SECRET` (or moving Convex), run `npx convex run whatsappConnect:refreshWebhooks` in `frontend/`. It re-registers every session's webhook. Linked phones stay linked.
