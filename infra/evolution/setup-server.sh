#!/usr/bin/env bash
# One-time setup of Stallo's WhatsApp gateway on a fresh Ubuntu cloud server
# (Oracle Always Free E2.1.Micro or similar), with the database on Neon. See ORACLE.md.
#
#   bash setup-server.sh
#
# Safe to run again: it skips what is already done and never overwrites an existing .env.
set -euo pipefail
cd "$(dirname "$0")"

echo "1/5 Swap (the free server has 1 GB of memory)"
if ! sudo swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "2/5 Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi

echo "3/5 Firewall: open ports 80 and 443 (Oracle's Ubuntu images block them)"
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport "$port" -j ACCEPT
done
if ! command -v netfilter-persistent >/dev/null; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent >/dev/null
fi
sudo netfilter-persistent save >/dev/null

echo "4/5 Settings (.env)"
if [ -f .env ]; then
  echo "    .env already exists, keeping it."
else
  ip="$(curl -fsS https://api.ipify.org)"
  domain="${ip//./-}.sslip.io"
  echo "    Paste Neon's DIRECT connection string (Neon > Connect > turn off 'Connection pooling'),"
  read -rsp "    then press Enter. It won't be shown: " db_url
  echo
  [ -n "$db_url" ] || { echo "No connection string given. Run this script again."; exit 1; }
  DB_URL="$db_url" DOMAIN="$domain" API_KEY="$(openssl rand -hex 32)" python3 - <<'PY'
import os, re
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

url = urlsplit(os.environ["DB_URL"].strip().strip('"').strip("'"))
if url.scheme not in ("postgres", "postgresql") or "-pooler" in (url.hostname or ""):
    raise SystemExit("That isn't Neon's direct connection string (it should start with postgresql:// and have no '-pooler'). Run the script again.")
query = dict(parse_qsl(url.query))
query.pop("channel_binding", None)  # Prisma (inside Evolution) doesn't support it
query.setdefault("sslmode", "require")
query.setdefault("schema", "public")
db = urlunsplit((url.scheme, url.netloc, url.path, urlencode(query), ""))

values = {
    "DATABASE_CONNECTION_URI": db,
    "EVOLUTION_DOMAIN": os.environ["DOMAIN"],
    "SERVER_URL": "https://" + os.environ["DOMAIN"],
    "AUTHENTICATION_API_KEY": os.environ["API_KEY"],
}
lines = []
for line in open(".env.example", encoding="utf-8").read().splitlines():
    key = line.split("=", 1)[0]
    lines.append(f"{key}={values.pop(key)}" if key in values and not line.startswith("#") else line)
lines += [f"{k}={v}" for k, v in values.items()]
fd = os.open(".env", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
PY
fi

echo "5/5 Start"
sudo docker compose -f docker-compose.neon.yml up -d

url="$(grep '^SERVER_URL=' .env | cut -d= -f2-)"
echo
echo "Done. It can take a minute for the HTTPS certificate. Then check:"
echo "    curl -s $url"
echo
echo "Values for Convex (run these on your laptop, in frontend/):"
echo "    EVOLUTION_API_URL = $url"
echo "    EVOLUTION_API_KEY = shown by:  grep '^AUTHENTICATION_API_KEY=' $(pwd)/.env"
