FROM node:22-alpine AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY . .

RUN pnpm --filter @balcona-bar/web build

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3001
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache wget
RUN corepack enable

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web ./apps/web

WORKDIR /app/apps/web

EXPOSE 3001

CMD ["sh", "-c", "pnpm exec next start --port ${PORT:-3001}"]
