# Run the WhatsApp gateway for free: Oracle Cloud + Neon

Evolution runs on an Oracle Cloud **Always Free** server, which stays on, and keeps its data in your **Neon** database. Caddy gives it HTTPS at a fixed address made from the server's IP (`<ip>.sslip.io`), so you don't need a domain. Nothing runs on your laptop.

Time: about 30 minutes. Cost: nothing. Oracle asks for a card to check you're a real person; Always Free resources are not charged.

## 1. Neon: get the direct connection string

1. In the Neon console, open your project (or create one, for example `stallo-evolution`, region close to Europe).
2. **Connect** → turn **off** "Connection pooling" → copy the connection string. It starts with `postgresql://` and its host has no `-pooler`.
3. Keep it to paste into the server in step 4. Don't put it in chat or in any file on your laptop.

## 2. Oracle: create the server

1. Sign up at oracle.com/cloud/free. Pick a home region near Ghana's users, for example **UK South (London)** or **Germany Central (Frankfurt)**. You can't change it later.
2. Menu → **Compute → Instances → Create instance**.
   - Name: `stallo-whatsapp`
   - Image: **Canonical Ubuntu 24.04** (or 22.04)
   - Shape: **VM.Standard.E2.1.Micro** (AMD, "Always Free-eligible"). Don't pick the Ampere ARM shape: it's often out of capacity.
   - Networking: keep "Create new virtual cloud network" and "Assign a public IPv4 address".
   - SSH keys: **Generate a key pair for me** → **Save private key** (a `.key` file; keep it safe).
3. **Create**. When it's running, copy its **Public IP address**.

## 3. Oracle: open ports 80 and 443

1. On the instance page → the **Subnet** link → **Security Lists** → the default security list → **Add Ingress Rules**.
2. Add a rule: Source CIDR `0.0.0.0/0`, IP protocol TCP, destination port range `80,443`. **Add**.

(The server's own firewall is opened by the setup script.)

## 4. Set up the server

On your laptop, in PowerShell (use your key file and IP):

```
ssh -i C:\path\to\ssh-key.key ubuntu@<public-ip>
```

If it complains the key file is too open, run once: `icacls C:\path\to\ssh-key.key /inheritance:r /grant:r "$($env:USERNAME):R"`.

Then, on the server:

```
git clone --depth 1 -b feat/product-matching https://github.com/stallo-hq/stallo-web.git
cd stallo-web/infra/evolution
bash setup-server.sh
```

The script installs Docker, opens the firewall, asks for the Neon string (hidden while you paste), generates the API key, and starts Evolution and Caddy. At the end it prints the address. Check it answers:

```
curl -s https://<ip-with-dashes>.sslip.io
```

It should return a short JSON welcome from Evolution. If you get a certificate error, wait a minute and try again. If it still fails after 5 minutes, see "If something goes wrong" below.

## 5. Connect Convex

On your laptop, in `frontend/`:

```
npx convex env set EVOLUTION_API_URL https://<ip-with-dashes>.sslip.io
npx convex env set EVOLUTION_API_KEY <the AUTHENTICATION_API_KEY from the server's .env>
npx convex env set EVOLUTION_WEBHOOK_SECRET <a new random value, 64 characters>
```

To make the random value in PowerShell:

```
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | % { $_.ToString("x2") })
```

 To see the API key on the server: `grep '^AUTHENTICATION_API_KEY=' ~/stallo-web/infra/evolution/.env`.

Then in the dashboard: **Settings → WhatsApp → Show QR code**, and scan it from the phone: WhatsApp → Linked devices → Link a device.

## Everyday commands (on the server)

```
cd ~/stallo-web/infra/evolution
sudo docker compose -f docker-compose.neon.yml ps          # is it running
sudo docker compose -f docker-compose.neon.yml logs -f evolution   # watch the logs (Ctrl+C to stop)
sudo docker compose -f docker-compose.neon.yml restart     # restart
```

It starts again by itself after the server reboots.

## If something goes wrong

- **ssh times out:** the instance isn't running yet, or you used the wrong IP.
- **curl can't connect:** check the ingress rule in step 3, then `sudo docker compose -f docker-compose.neon.yml logs caddy`.
- **Certificate never arrives** (Caddy logs mention rate limits for sslip.io): get a free name at duckdns.org pointing to the server's IP, set `EVOLUTION_DOMAIN` and `SERVER_URL` in `.env` to it, `sudo docker compose -f docker-compose.neon.yml up -d`, and update `EVOLUTION_API_URL` in Convex.
- **Evolution keeps restarting, logs mention the database:** the Neon string is wrong or is the pooled one. Edit `DATABASE_CONNECTION_URI` in `.env` (`nano .env`) and `up -d` again.
- **The address changed** (new server or domain): update `EVOLUTION_API_URL` in Convex, then `npx convex run whatsappConnect:refreshWebhooks` in `frontend/`. Linked phones stay linked.

## Good to know

- Neon's free plan pauses the database after a few minutes without use and wakes it on the next request. The first message after a quiet spell can take a second or two longer.
- **Oracle reclaims idle Always Free servers** (very low CPU, network and memory use over 7 days) on free-trial accounts, and a quiet gateway can look idle. To prevent it, upgrade the account to **Pay As You Go** (Billing → Upgrade). Always Free resources stay free; you are only charged if you create paid ones, so set a budget alert at 1 USD. If a server is reclaimed, create a new one and repeat steps 2 to 5; sellers may have to scan again.
- Keep the `.key` file and the server's `.env` private. Anyone with the API key can send messages from linked numbers.
