# ==============================================================================
# Multi-Stage Production Dockerfile for SitePilot Next.js on Google Cloud Run
# ==============================================================================

# 1. Base Dependencies Stage
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Keep the complete production dependency tree available to the server-only
# Taskmaster worker. The worker dynamically loads the official ADK and GenAI
# modules, so Next standalone tracing cannot reliably discover their
# transitive dependencies. Prune development tooling before copying it into
# the runtime image.
FROM deps AS runtime-deps
RUN npm prune --omit=dev

# 2. Builder Stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV OUTPUT_STANDALONE=true

RUN npm run build

# 3. Production Runner Stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public static assets and standalone server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The Taskmaster worker loads the official ADK and GenAI modules from the
# runtime filesystem. Copy only production dependencies; no development tools
# or credentials enter the image.
COPY --from=runtime-deps /app/node_modules ./node_modules

USER nextjs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/api/health || exit 1

CMD ["node", "server.js"]
