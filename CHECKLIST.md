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

- [x] Categories: admin CRUD, nested tree in one query, cycle-safe re-parenting, soft delete blocked while subcategories exist
- [x] Products: admin CRUD with category assignment, auto slugs, SKU uniqueness, compare-at price rule, soft delete (archive)
- [x] Product images: metadata for uploaded assets (URL and Cloudinary public id), primary image management, promotion when the primary is removed
- [x] Inventory: set and adjust with audit log, stock can't go negative or below reserved units, shoppers see IN_STOCK / LOW_STOCK / OUT_OF_STOCK only
- [x] Search: PostgreSQL full-text (generated `tsvector`, GIN index, English stemming, weighted columns)
- [x] Cursor pagination (keyset) for the storefront; offset pagination for the admin list
- [x] Public filters: category, price range, featured, sort by newest / price / best selling
- [x] Tests: 46 passing across auth, catalogue and DB constraints
- [ ] Cloudinary upload (needs account credentials and your approval, Phase 5/6)
- [ ] Category filter includes subcategories (currently only direct assignments)
- [ ] Clearing a compare-at price via the API (currently only setting a new value)
- [ ] Product variants such as ring sizes (needs a design decision before Phase 5)

## Phase 4 — Storefront

- [x] Next.js 16 App Router setup (`apps/storefront`), React 19, Tailwind CSS 4, server components by default
- [x] Brand theme from the VRINOOR reference: brown, cream and gold palette, Georgia headings, same tone (built on our API, not Supabase)
- [x] Homepage: hero, shop by category, featured, new arrivals, best sellers (hidden when empty), "Why VRINOOR"
- [x] Product listing: category, search, price range, featured, sort, "Load more" (cursor)
- [x] Product detail: image gallery with hover and tap zoom, price and discount, stock status, SKU, description, related products, JSON-LD for search engines
- [x] Responsive: checked at 375px (no horizontal overflow) and desktop
- [x] Bag and wishlist: kept in the browser, prices and stock refreshed from the API on view
- [x] Unit tests for money, bag and wishlist logic (12 passing)
- [x] Brand categories seeded (`pnpm db:seed`)
- [ ] Bag and wishlist on the server for signed-in customers (with accounts and checkout, Phase 5)
- [ ] Checkout, Razorpay, Shiprocket (Phase 5)
- [ ] Brand logo, favicon and homepage banners from admin store settings (Phase 6). Hero copy is fixed for now.
- [ ] Storefront images use Cloudinary URLs. Upload endpoints arrive with Cloudinary credentials (Phase 5/6).
- [ ] Shared API rate limit: server rendering calls the API from one IP, so the limit must be raised or moved to Redis (Phase 7)
- [ ] Load-more paging and empty states checked with 24+ products (only 4 test products were available)
- [ ] Product detail is not cached in Next yet (fresh on every request, so archived products return a real 404). Add API-side caching in Phase 7.

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
