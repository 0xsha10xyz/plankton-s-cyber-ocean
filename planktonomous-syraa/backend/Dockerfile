# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci --no-audit --no-fund
COPY src/ ./src/
COPY prisma/ ./prisma/
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/prisma ./prisma
USER appuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["./node_modules/.bin/pm2-runtime", "dist/index.js", "--name", "planktonomous-syraa-backend"]

