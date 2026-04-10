# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

# ── Install deps ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# BACKEND_URL is the internal Docker service URL used by Next.js rewrites at build time
ARG BACKEND_URL=http://backend:5100
ENV BACKEND_URL=${BACKEND_URL}
RUN npm run build
RUN npm prune --omit=dev

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

RUN addgroup -S faro && adduser -S faro -G faro

COPY --from=build --chown=faro:faro /app/package.json ./package.json
COPY --from=build --chown=faro:faro /app/node_modules ./node_modules
COPY --from=build --chown=faro:faro /app/.next ./.next
COPY --from=build --chown=faro:faro /app/next.config.ts ./next.config.ts
COPY --from=build --chown=faro:faro /app/public ./public

USER faro
EXPOSE 3100

CMD ["sh", "-c", "./node_modules/.bin/next start -p ${PORT:-3100} -H ${HOSTNAME:-0.0.0.0}"]
