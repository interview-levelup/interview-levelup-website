# ── Build stage ───────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS build

ENV BUN_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . ./

# Receive the API base URL at build time so Vite can bake it into the bundle
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN bun run build

# ── Runtime stage (Caddy) ─────────────────────────────────────────────────────
FROM caddy

WORKDIR /app

COPY Caddyfile ./
RUN caddy fmt Caddyfile --overwrite

COPY --from=build /app/dist ./dist

CMD ["caddy", "run", "--config", "Caddyfile", "--adapter", "caddyfile"]
