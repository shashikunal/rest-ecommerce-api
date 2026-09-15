FROM node:22-alpine AS base

WORKDIR /app

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
RUN apk add --no-cache curl
ENV NODE_ENV=production
ENV PORT=$PORT
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE $PORT
CMD ["node", "dist/src/server.js"]
