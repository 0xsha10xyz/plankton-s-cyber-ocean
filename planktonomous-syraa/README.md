# Planktonomous × Syraa (VPS, production-grade)

This directory contains a standalone, containerized backend that integrates the Planktonomous agent with the Syraa signal gateway using an HTTP 402 (X402) micropayment flow on Solana devnet USDC.

## Local development

```bash
cd planktonomous-syraa/backend
npm install
cp .env.example .env
# Fill in secrets in .env (and POSTGRES_USER/POSTGRES_PASSWORD/REDIS_PASSWORD for compose)
```

From `planktonomous-syraa/`:

```bash
docker compose up -d --build
docker compose exec backend npx prisma migrate dev
curl http://localhost:3001/health
curl http://localhost:3001/readiness
```

## VPS deployment (production)

```bash
# 1. Clone & configure
git clone <your-repo>
cd planktonomous-syraa
cp backend/.env.example backend/.env
# → Fill in all secrets in backend/.env

# Required format notes:
# - SOLANA_WALLET_PRIVATE_KEY must be a JSON array of 64 numbers (Uint8Array secret key)
# - Set POSTGRES_USER / POSTGRES_PASSWORD / REDIS_PASSWORD (used by docker compose services)

# 2. SSL certificate (Let's Encrypt)
certbot certonly --standalone -d your-vps-domain.com
cp /etc/letsencrypt/live/your-vps-domain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/your-vps-domain.com/privkey.pem nginx/ssl/

# 3. Build & start
docker compose -f docker-compose.prod.yml up -d --build

# 4. Run DB migrations
docker compose exec backend npx prisma migrate deploy

# 4.1 Create an API key (store output securely)
docker compose exec backend npm run apikey:create -- "vps-admin"

# 5. Verify
curl https://your-vps-domain.com/health
curl https://your-vps-domain.com/readiness
```

