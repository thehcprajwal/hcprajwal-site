# ── Stage 1: Build ─────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Build tools required for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune to production deps only (keeps compiled native modules)
RUN npm prune --production


# ── Stage 2: Production runtime ────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy pre-built node_modules (includes compiled better-sqlite3)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist

COPY package*.json ./
COPY server/       ./server/

# SQLite data directory
RUN mkdir -p /app/data

RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app/data

USER appuser

EXPOSE 3001

CMD ["node", "server/index.js"]
