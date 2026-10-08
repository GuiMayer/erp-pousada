FROM node:22-alpine AS base

RUN apk add --no-cache openssl gcompat

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY lib/server/env.ts ./lib/server/env.ts
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG NEXT_PUBLIC_DATA_ADAPTER=database
ARG NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_PUBLIC_DATA_ADAPTER=$NEXT_PUBLIC_DATA_ADAPTER
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm db:generate
RUN pnpm build
RUN pnpm prune --prod

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000

CMD ["pnpm", "start", "--hostname", "0.0.0.0"]
