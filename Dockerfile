# ==============================================================================
# Multi-Stage Production Dockerfile for SitePilot Next.js on Google Cloud Run
# ==============================================================================

# 1. Base Dependencies Stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# 2. Builder Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV OUTPUT_STANDALONE=true

RUN npm run build

# 3. Production Runner Stage
FROM node:20-alpine AS runner
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

# The Taskmaster worker loads the official ADK's narrow ESM modules from the
# runtime filesystem. Next standalone tracing cannot discover that dynamic
# import's transitive packages, so copy the ADK dependency boundary explicitly
# without copying development tools or credentials into the image.
COPY --from=deps /app/node_modules/@a2a-js ./node_modules/@a2a-js
COPY --from=deps /app/node_modules/@google/adk ./node_modules/@google/adk
COPY --from=deps /app/node_modules/@google-cloud/vertexai ./node_modules/@google-cloud/vertexai
COPY --from=deps /app/node_modules/@google/genai ./node_modules/@google/genai
COPY --from=deps /app/node_modules/@mikro-orm ./node_modules/@mikro-orm
COPY --from=deps /app/node_modules/@opentelemetry ./node_modules/@opentelemetry
COPY --from=deps /app/node_modules/adm-zip ./node_modules/adm-zip
COPY --from=deps /app/node_modules/google-auth-library ./node_modules/google-auth-library
COPY --from=deps /app/node_modules/js-yaml ./node_modules/js-yaml
COPY --from=deps /app/node_modules/jsonpath-plus ./node_modules/jsonpath-plus
COPY --from=deps /app/node_modules/lodash-es ./node_modules/lodash-es
COPY --from=deps /app/node_modules/winston ./node_modules/winston
COPY --from=deps /app/node_modules/zod ./node_modules/zod
COPY --from=deps /app/node_modules/zod-to-json-schema ./node_modules/zod-to-json-schema

USER nextjs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/api/health || exit 1

CMD ["node", "server.js"]
