# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV \
    PRISMA_SKIP_POSTINSTALL_GENERATE="1"
RUN apk add --no-cache python3 make g++ \
    && corepack enable pnpm
COPY package.json pnpm-lock.yaml ./

FROM base AS deps
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS builder
COPY tsconfig.json ./
COPY vitest.config.ts ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
RUN pnpm prisma:gen
RUN pnpm run build
RUN pnpm prune --prod --ignore-scripts

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node","dist/src/server.js"]
