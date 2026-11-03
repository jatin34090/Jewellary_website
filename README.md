# Jewellery E-commerce

A standalone, single-brand jewellery e-commerce platform built as a **modular monolith**
(pnpm + Turborepo monorepo). It is an independent project and does not share code, containers,
databases, or configuration with any other application.

- **Storefront:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **API:** NestJS, Prisma, class-validator, Swagger (`/api/v1`)
- **Worker:** BullMQ background jobs
- **Data:** PostgreSQL 16, Redis 7
- **External services:** Cloudinary, Razorpay, Shiprocket, Cloudflare

See [CHECKLIST.md](CHECKLIST.md) for progress by phase.

## Repository layout

```
apps/
  storefront/   Next.js storefront and admin (Phase 4+)
  api/          NestJS REST API (Phase 2+)
  worker/       BullMQ background worker (Phase 7)
packages/
  database/     Prisma schema and migrations (Phase 2)
  types/        Shared TypeScript types
  validation/   Shared validation schemas
  config/       Shared typed configuration helpers
  ui/           Shared React UI components
infrastructure/
  docker/       Dockerfiles (Phase 8)
  nginx/        Nginx configuration (Phase 8)
  scripts/      Deployment and maintenance scripts (Phase 8)
.github/workflows/  CI/CD pipelines (Phase 8)
docker-compose.dev.yml  Local PostgreSQL and Redis
```

## Prerequisites (Windows)

| Tool            | Required version | Check command        |
| --------------- | ---------------- | -------------------- |
| Node.js         | 22 LTS           | `node --version`     |
| pnpm            | 10.x             | `pnpm --version`     |
| Git             | any recent       | `git --version`      |
| Docker Desktop  | running          | `docker info`        |

## First-time setup

Run these in PowerShell from the repository root:

```powershell
# 1. Install dependencies
pnpm install

# 2. Create your local environment file (only once).
#    .env is already generated for local development. Never commit it.
#    If you need to recreate it, copy .env.example and replace every placeholder.
Copy-Item .env.example .env

# 3. Start local PostgreSQL and Redis
pnpm infra:up
```

## Local ports

| Service     | Host address     | Port |
| ----------- | ---------------- | ---- |
| Storefront  | localhost        | 3000 |
| API         | localhost        | 3001 |
| PostgreSQL  | 127.0.0.1 only   | 5433 |
| Redis       | 127.0.0.1 only   | 6380 |

PostgreSQL and Redis are bound to `127.0.0.1` and are not reachable from other machines.

## Daily commands

```powershell
pnpm infra:up        # start PostgreSQL and Redis (waits until healthy)
pnpm infra:down      # stop PostgreSQL and Redis (keeps data)
pnpm infra:logs      # follow container logs

pnpm dev             # run all apps in watch mode (once apps exist)
pnpm lint            # ESLint across all packages
pnpm typecheck       # TypeScript strict type checking
pnpm build           # build all apps and packages
pnpm format          # format with Prettier
pnpm format:check    # check formatting without changing files
```

## Data safety

- Local data lives in named Docker volumes `jewellery-ecommerce-pgdata-dev` and
  `jewellery-ecommerce-redisdata-dev`. `pnpm infra:down` keeps them.
- Do **not** run `docker compose down -v` against this project unless you intend to delete the
  local database.
- Container names, the network, and volumes are unique to this project. Never point this project
  at another project's containers or volumes.

## Environment variables

All configuration comes from environment variables. `.env.example` documents every variable.
Secrets must never be committed or printed in logs. The production secrets will be stored in
GitHub Secrets and on the VPS, not in the repository.
