# ──────────────────────────────────────────────────────────────────────────────
# Stripe RAG Frontend – Dockerfile
# Multi-stage: Node.js build → nginx:alpine production image
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build the React / Vite app ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
# VITE_API_BASE is intentionally left empty so the built JS makes same-origin
# requests – nginx (stage 2) proxies /query /sessions /session /ingest to the
# backend container over the Docker internal network.
COPY . .
RUN npm run build

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:stable-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our proxy + SPA config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
