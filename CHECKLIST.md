# Project checklist

Status key: `[x]` done · `[ ]` pending · `[~]` partially done

## Phase 1 — Environment inspection and project setup

- [x] Inspect Windows environment (Node, pnpm, Git, Docker)
- [x] Confirm project directory did not exist before creation
- [x] Initialize pnpm workspace (`pnpm-workspace.yaml`, `packageManager` pinned to pnpm 10.33.4)
- [x] Initialize Turborepo (`turbo.json`)
- [x] Create monorepo structure (`apps/`, `packages/`, `infrastructure/`, `.github/workflows/`)
- [x] Configure TypeScript strict mode (`tsconfig.base.json`)
- [x] Configure ESLint 10 flat config with typescript-eslint strict type-checked rules
- [x] Configure Prettier
- [x] Create `.env.example` and local `.env` (random secrets, not committed)
- [x] Create `.gitignore` (excludes `.env`, `node_modules`, build output)
- [x] Create `docker-compose.dev.yml` (PostgreSQL 16 on 127.0.0.1:5433, Redis 7 on 127.0.0.1:6380)
- [x] Start PostgreSQL and Redis containers (`pnpm infra:up`)
- [x] Verify PostgreSQL connectivity (PostgreSQL 16.15, accepting connections)
- [x] Verify Redis connectivity (PING with auth; unauthenticated access rejected)
- [x] Verify `pnpm typecheck` and `pnpm lint` pass across all packages
- [x] Write README with setup and daily commands
- [x] Node.js version decision: Node 20.19.4 is kept. Every Phase 2 dependency supports it (Prisma 7, NestJS 12). Node 22 is still listed as the target in `package.json`; install it when convenient
- [x] User approval to start Phase 2

## Phase 2 — Database and backend foundation

- [x] Design Prisma schema (all 21 requested models plus RefreshToken and WebhookEvent; Role is an enum on User)
- [x] Configure Prisma 7 migrations (`init` and `add_integrity_constraints` with CHECK constraints)
- [x] Set up NestJS application (`apps/api`, NestJS 12, Node 20 compatible)
- [x] Health endpoints (`/health/live`, `/health` with database check)
- [x] Authentication: Argon2id hashing, short-lived access tokens, rotating refresh tokens in HttpOnly cookies, reuse detection, global guards, role-based authorisation
- [x] Swagger documentation at `/api/v1/docs`
- [x] Consistent success and error envelopes, DTO validation with whitelisting, rate limits on auth routes
- [x] Tests: 22 passing (auth flows, token rotation and replay, mass-assignment protection, DB constraints, env validation, role guard)
- [ ] Redis-backed rate limit storage (Phase 7)
- [ ] Admin bootstrap / seed script (Phase 6)
- [ ] Account lockout after repeated failed logins (Phase 7)
- [ ] Email verification and password reset (Phase 7, with the notifications worker)

## Phase 3 — Product catalogue

- [ ] Categories
- [ ] Products
- [ ] Product images
- [ ] Inventory
- [ ] Search and cursor pagination

## Phase 4 — Storefront

- [ ] Next.js App Router setup (`apps/storefront`)
- [ ] Homepage
- [ ] Product listing
- [ ] Product detail
- [ ] Responsive design
- [ ] Cart and wishlist

## Phase 5 — Checkout and orders

- [ ] Address management
- [ ] Order creation
- [ ] Inventory reservation
- [ ] Razorpay integration
- [ ] Payment verification and webhook signature check
- [ ] Shiprocket integration

## Phase 6 — Admin dashboard

- [ ] Product management
- [ ] Category management
- [ ] Order management
- [ ] Inventory management
- [ ] Store configuration
- [ ] Banner management

## Phase 7 — Performance and security

- [ ] Redis caching and invalidation
- [ ] Rate limiting
- [ ] Background workers (BullMQ)
- [ ] Security hardening
- [ ] Logging
- [ ] Testing

## Phase 8 — Deployment preparation

- [ ] Production Dockerfiles
- [ ] Production `docker-compose.yml`
- [ ] GitHub Actions pipeline
- [ ] VPS deployment scripts
- [ ] Nginx configuration
- [ ] Health checks
- [ ] Backup and rollback strategy

## Phase 9 — Testing and optimization

- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] k6 load tests
- [ ] Bottleneck analysis and optimization
