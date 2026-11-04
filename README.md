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

| Tool           | Required version | Check command    |
| -------------- | ---------------- | ---------------- |
| Node.js        | 22 LTS           | `node --version` |
| pnpm           | 10.x             | `pnpm --version` |
| Git            | any recent       | `git --version`  |
| Docker Desktop | running          | `docker info`    |

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

| Service    | Host address   | Port |
| ---------- | -------------- | ---- |
| Storefront | localhost      | 3000 |
| API        | localhost      | 3001 |
| PostgreSQL | 127.0.0.1 only | 5433 |
| Redis      | 127.0.0.1 only | 6380 |

PostgreSQL and Redis are bound to `127.0.0.1` and are not reachable from other machines.

## Daily commands

```powershell
pnpm infra:up        # start PostgreSQL and Redis (waits until healthy)
pnpm infra:down      # stop PostgreSQL and Redis (keeps data)
pnpm infra:logs      # follow container logs

pnpm db:migrate      # create and apply a migration after changing schema.prisma
pnpm db:deploy       # apply committed migrations only (used in CI and production)
pnpm db:generate     # regenerate the Prisma client

pnpm db:seed         # add the six brand categories (safe to run again)

pnpm --filter @jewellery/api dev          # API in watch mode, http://127.0.0.1:3001
pnpm --filter @jewellery/storefront dev   # storefront, http://localhost:3000
pnpm --filter @jewellery/api test   # API tests; end-to-end suites need the isolated test database (see Test database)
pnpm lint            # ESLint across all packages
pnpm typecheck       # TypeScript strict type checking
pnpm test            # all test suites
pnpm build           # build all apps and packages
pnpm format          # format with Prettier
pnpm format:check    # check formatting without changing files
```

## API

- Base URL: `http://127.0.0.1:3001/api/v1`
- Swagger UI: `http://127.0.0.1:3001/api/v1/docs` (enabled by `SWAGGER_ENABLED=true`, off in production)
- Health: `GET /api/v1/health/live` (process up), `GET /api/v1/health` (database reachable)
- Auth: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`
- Catalogue (public): `GET /api/v1/categories`, `GET /api/v1/categories/:slug`, `GET /api/v1/products` (filters: `q`, `category`, `minPrice`, `maxPrice`, `featured`, `sort`, `limit`, `cursor`), `GET /api/v1/products/:slug`
- Saved bag and wishlist (signed in): `GET` and `PUT /api/v1/account/bag`, `GET` and `PUT /api/v1/account/wishlist`
- Analytics (admin, `ADMIN` or `STAFF`): `GET /api/v1/admin/analytics?days=7|30|90`
- Catalogue (admin, `ADMIN` or `STAFF`): `/api/v1/admin/categories`, `/api/v1/admin/products`, `/api/v1/admin/products/:id/images`, `/api/v1/admin/products/:id/inventory`
- Every response is wrapped: `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code", "message", "details?" } }`.
- Access tokens (15 min) go in `Authorization: Bearer <token>`. The refresh token is an HttpOnly cookie scoped to `/api/v1/auth`.

Routes are protected by default. Mark a route `@Public()` to open it, and `@Roles(...)` to restrict it by role.

## Database

The schema lives in `packages/database/prisma/schema.prisma`. Migrations are in
`packages/database/prisma/migrations`. `20261103094401_add_integrity_constraints` adds CHECK
constraints (non-negative money, positive quantities, rating range) that Prisma cannot express.
Keep those rules when you edit related tables.

## Data safety

- Local data lives in named Docker volumes `jewellery-ecommerce-pgdata-dev` and
  `jewellery-ecommerce-redisdata-dev`. `pnpm infra:down` keeps them.
- Do **not** run `docker compose down -v` against this project unless you intend to delete the
  local database.
- Container names, the network, and volumes are unique to this project. Never point this project
  at another project's containers or volumes.

## Environment variables

All configuration comes from environment variables. `.env.example` documents every variable.
The Cloudinary keys (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) are blank in `.env`. Fill them in
from your Cloudinary dashboard. The storefront reads its API address from `apps/storefront/.env.local`.
Secrets must never be committed or printed in logs. The production secrets will be stored in
GitHub Secrets and on the VPS, not in the repository.

## Payments, shipping and media

Keys live in `.env` (blank until you add them). The API starts without them. Checkout then says which service is not configured.

- **Razorpay (test mode first):** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. In the Razorpay dashboard, point the webhook at `https://<api-domain>/api/v1/webhooks/razorpay` and subscribe to `payment.captured` and `payment.failed`.
- **Shiprocket:** `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_LOCATION`. Paid orders are booked automatically, and failed bookings are retried.
- **Cloudinary:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Uploads go straight from the browser to Cloudinary with a signed request, so the API secret never leaves the server.
- **Checkout timing:** `ORDER_RESERVATION_MINUTES` (default 30). Unpaid orders past this are cancelled and their stock released.

Checkout does not charge anything until the Razorpay keys are set. Use Razorpay test keys until you approve going live.

## Admin panel

Open `http://localhost:3000/admin`. Signed-out visitors see the sign-in form on that page. Staff and admin accounts are normal accounts with a role.

Create the first admin with the bootstrap script. Set the values for this one run, so the password is not kept in your shell history:

```powershell
$env:ADMIN_EMAIL = "you@example.com"
$env:ADMIN_PASSWORD = "use-a-strong-password-1"
$env:ADMIN_FIRST_NAME = "Your"
pnpm --filter @jewellery/api admin:create
Remove-Item Env:ADMIN_PASSWORD
```

If the account already exists, the script promotes it to admin and keeps its password. The password must be 8 to 128 characters with a letter and a digit.

Sales figures are on `/admin/analytics` (7, 30 or 90 days, India time).

**Refunds.** Admins can view a refund history, issue a refund for all or part of a paid order, and check a pending refund with Razorpay. Staff can view the history but cannot issue or check refunds. Customers have no access.

### Refunds and pending refunds: known limitations

- A refund is recorded as **pending** before Razorpay is called. It stays pending until Razorpay confirms its outcome. Only a Razorpay status of processed counts as money returned. Failed is final.
- An admin can use the **Check status** action on a pending refund to ask Razorpay for its current status.
- If Razorpay never received the request, the refund may **remain pending indefinitely**. The app cannot tell that apart from a refund still being processed.
- A pending refund **blocks additional refunds** against that payment until the pending refund is resolved.
- There is **currently no manual admin resolution mechanism**. An unresolved refund cannot be closed or marked failed from the app. Doing so safely is deferred work (see CHECKLIST.md).
- **Razorpay webhook integration for refunds is not implemented yet.** Refund status changes are picked up only when an admin uses Check status.

## Test database

The end-to-end suites never use the development database. They read `apps/api/.env.test` (git-ignored) and refuse to start unless the database name ends in `_test`.

One-time setup. Replace the placeholder with a password of your own, and keep it out of shell history:

```bash
docker exec -i jewellery-ecommerce-postgres-dev psql -U jewellery -d jewellery -c "CREATE ROLE jewellery_test LOGIN PASSWORD '<choose-a-password>';"
docker exec -i jewellery-ecommerce-postgres-dev psql -U jewellery -d jewellery -c "CREATE DATABASE jewellery_test OWNER jewellery_test;"
```

Create `apps/api/.env.test` with these keys (the database line uses the password you chose):

```
DATABASE_URL=postgresql://jewellery_test:<choose-a-password>@127.0.0.1:5433/jewellery_test?schema=public
JWT_ACCESS_SECRET=<at least 32 random characters>
NODE_ENV=test
CLOUDINARY_CLOUD_NAME=demo
CLOUDINARY_API_KEY=e2e-test-key
CLOUDINARY_API_SECRET=e2e-test-secret-not-real
CLOUDINARY_UPLOAD_FOLDER=e2e-test
```

Apply the migrations to the test database only. Set `DATABASE_URL` to the test value for this one command, and do not use the development value:

```powershell
$env:DATABASE_URL = "<the DATABASE_URL line from apps/api/.env.test, without the key name>"
pnpm --filter @jewellery/database db:deploy
Remove-Item Env:DATABASE_URL
```

Then run the suites with `pnpm --filter @jewellery/api test`. Each run tags its accounts with a unique identifier and removes only those.

## Database migrations: a warning

The `searchVector` column and its GIN index are maintained by a hand-written migration, because Prisma cannot model generated `tsvector` columns. When you run `pnpm db:migrate`, Prisma may propose dropping them. Remove those statements from the new migration before you apply it, or full-text search breaks.
