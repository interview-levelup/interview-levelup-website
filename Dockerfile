# ── Build stage ───────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS build

ENV BUN_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . ./
RUN bun run build

# ── Runtime stage (Caddy) ─────────────────────────────────────────────────────
FROM caddy

WORKDIR /app

COPY Caddyfile ./
RUN caddy fmt Caddyfile --overwrite

COPY --from=build /app/dist ./dist

CMD ["caddy", "run", "--config", "Caddyfile", "--adapter", "caddyfile"]
