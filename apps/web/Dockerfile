# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat \
    && corepack enable pnpm
COPY package.json pnpm-lock.yaml ./

FROM base AS deps
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG VITE_API_URL=http://localhost:3000/api
ARG VITE_ASSETS_BASE_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ASSETS_BASE_URL=$VITE_ASSETS_BASE_URL
COPY . .
RUN pnpm run build

FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
