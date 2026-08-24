#!/bin/bash
# ==========================================================
# BRISK VPS Initial Setup Script
# Run as root on Ubuntu 24.04: bash vps-setup.sh
# ==========================================================

set -e

APP_DIR=/opt/brisk
APP_USER=brisk
DB_PASSWORD="Br1sk_DB_$(openssl rand -hex 8)"
DB_NAME=brisk_db
DB_USER=brisk_user

echo ""
echo "============================================"
echo " BRISK VPS Setup — Ubuntu 24.04"
echo "============================================"
echo ""

# ---- 1. System updates ----
echo "[1/9] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ---- 2. Install Node.js 20 LTS ----
echo "[2/9] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ---- 3. Install PM2, Git, curl, Docker ----
echo "[3/9] Installing PM2, Git, Docker..."
npm install -g pm2
apt-get install -y git curl ufw

# Docker
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
apt-get install -y docker-compose-plugin

# ---- 4. Firewall ----
echo "[4/9] Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp     # app (nginx will proxy; keep open for health checks)
echo "y" | ufw enable

# ---- 5. Create app user ----
echo "[5/9] Creating app user '$APP_USER'..."
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
fi

# ---- 6. Clone repo ----
echo "[6/9] Cloning repository to $APP_DIR..."
if [ ! -d "$APP_DIR/.git" ]; then
  git clone https://github.com/norvantechnology/Brisk.git "$APP_DIR"
else
  echo "Repo already cloned — skipping."
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ---- 7. PostgreSQL via Docker ----
echo "[7/9] Starting PostgreSQL in Docker..."

cat > /opt/brisk-postgres.yml <<COMPOSE
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: brisk_postgres
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
COMPOSE

docker compose -f /opt/brisk-postgres.yml up -d
echo "Waiting for Postgres to start..."
sleep 6

# ---- 8. Create .env ----
echo "[8/9] Creating .env file..."

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')

cat > "$APP_DIR/.env" <<ENV
NODE_ENV=production
PORT=3000
DATABASE_URL=${DATABASE_URL}
DIRECT_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
ENV

chmod 600 "$APP_DIR/.env"
chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"

# ---- 9. Install deps, build, migrate, start ----
echo "[9/9] Installing npm deps, building, migrating..."
cd "$APP_DIR"

npm ci --omit=dev
npx prisma generate --schema=src/database/schema.prisma
npx prisma migrate deploy --schema=src/database/schema.prisma
npm run build

# Start with PM2 as root (managed by root; PM2 startup will run on boot)
pm2 start dist/server.js --name brisk-backend --env production
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo ""
echo "============================================"
echo " SETUP COMPLETE"
echo "============================================"
echo ""
echo " App running:  http://104.207.88.181:3000"
echo " Health:       http://104.207.88.181:3000/health"
echo " PM2 status:   pm2 status"
echo " PM2 logs:     pm2 logs brisk-backend"
echo ""
echo " DB credentials (save these!):"
echo "   HOST:     127.0.0.1:5432"
echo "   DB:       $DB_NAME"
echo "   USER:     $DB_USER"
echo "   PASSWORD: $DB_PASSWORD"
echo ""
echo " .env saved to: $APP_DIR/.env"
echo ""
echo "============================================"
echo " NEXT STEPS — read vps-setup.sh comments"
echo "============================================"
echo " 1. Add GitHub Secrets (see below)"
echo " 2. Set up SSH key for GitHub Actions"
echo " 3. (Optional) Configure Nginx + SSL"
echo ""
