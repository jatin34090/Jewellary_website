# Project checklist

Status key: `[x]` done · `[~]` partially done or not fully verified · `[ ]` pending

Verification labels used below:

- **Automated:** covered by a test in the repository and run against the isolated `jewellery_test` database (API) or the Vitest unit suite (storefront).
- **Manual:** checked by hand in a browser or against live services. No repeatable evidence is recorded in the repository.
- **Not verified:** no automated test or recorded evidence exists in the repository.

Test counts shown in phase notes are historical, recorded at the end of that phase. The current suite is in [Verification notes](#verification-notes).

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
- [x] Tests: 22 passing at the end of Phase 2 (auth flows, token rotation and replay, mass-assignment protection, DB constraints, env validation, role guard). Automated. Historical count.
- [ ] Redis-backed rate limit storage (Phase 7)
- [x] Admin bootstrap script: `pnpm --filter @jewellery/api admin:create`. Reads ADMIN_EMAIL and ADMIN_PASSWORD from the environment and promotes an existing account. It also reads the root `.env` if present, so set `DATABASE_URL` in the shell to choose the target database. Manual: run once against the development database.
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
- [x] Tests: 46 passing across auth, catalogue and DB constraints at the end of Phase 3. Automated. Historical count.
- [~] Cloudinary upload: signed upload flow is implemented. A live upload of one image was reported during development. No automated test calls Cloudinary, and video upload is not verified end to end.
- [x] Category filter includes subcategories (recursive tree, cycle-safe). Automated: catalogue suite, "includes products in subcategories".
- [x] Clearing a compare-at price via the API (send `compareAtPrice: null`). Automated: catalogue suite.
- [ ] Product variants such as ring sizes (needs a design decision before Phase 5). See [Deferred engineering work](#deferred-engineering-work).

## Phase 4 — Storefront

- [x] Next.js 16 App Router setup (`apps/storefront`), React 19, Tailwind CSS 4, server components by default
- [x] Brand theme from the VRINOOR reference: brown, cream and gold palette, Georgia headings, same tone (built on our API, not Supabase)
- [x] Homepage: hero, shop by category, featured, new arrivals, best sellers (hidden when empty), "Why VRINOOR"
- [x] Product listing: category, search, price range, featured, sort, "Load more" (cursor)
- [x] Product detail: image gallery with hover and tap zoom, price and discount, stock status, SKU, description, related products, JSON-LD for search engines
- [x] Responsive: checked at 375px (no horizontal overflow) and desktop
- [x] Bag and wishlist: kept in the browser, prices and stock refreshed from the API on view
- [x] Unit tests for money, bag and wishlist logic (12 passing at the end of Phase 4; the storefront suite now has 16 tests). Automated. Historical count.
- [x] Brand categories seeded (`pnpm db:seed`)
- [~] Bag and wishlist on the server for signed-in customers. API: 8 automated tests (saves and merges lines, drops unknown and archived products, per-customer isolation, limits). The merge helpers are unit tested. The browser sync client, sign-in merge and sign-out clearing are not covered by automated tests.
- [ ] Checkout, Razorpay, Shiprocket (Phase 5)
- [x] Brand logo, favicon and homepage banners from admin store settings (Phase 6). Hero copy is fixed for now.
- [~] Storefront images use Cloudinary URLs. Upload works; the seeded catalogue has no photos yet, so this is not checked on real product photos.
- [ ] Shared API rate limit: server rendering calls the API from one IP, so the limit must be raised or moved to Redis (Phase 7)
- [~] Load-more paging across more than 24 products: automated API test (24 products read across cursor pages with no duplicates). A browser check with 26 products is not recorded in the repository and is not claimed here.
- [ ] Product detail is not cached in Next yet (fresh on every request, so archived products return a real 404). Add API-side caching in Phase 7.

## Phase 5 — Checkout and orders

- [x] Addresses: saved per customer, PIN and mobile validation, one default, snapshot copied into each order
- [x] Pricing on the server only: totals and stock are computed from database prices, client prices are ignored
- [x] Coupons: validity window, usage limit, minimum order, percentage cap, applied at checkout
- [x] Shipping and tax rules: stored settings with explicit defaults of zero until you configure them
- [x] Order creation: stock is reserved atomically, the same Idempotency-Key always returns the same order
- [x] Razorpay: order creation, checkout signature verification (constant-time HMAC), webhook signature verification, duplicate webhook detection, amount check. Automated with a test gateway.
- [~] Checkout verification confirms each payment with Razorpay before the order is marked paid: the payment's order ID, amount, and status (captured or authorized) are read back from Razorpay. Automated tests use a fake gateway. No test covers a payment with a mismatched order ID or an unexpected status.
- [x] Duplicate payment protection: guarded status transitions, one payment per gateway order, reserved stock converted to sales once. Automated.
- [x] Unpaid orders are cancelled after the reservation window (default 30 minutes) and their stock and coupon use are released. Automated.
- [~] Shiprocket: login and courier order creation were reported working during development. AWB assignment is blocked until the Shiprocket wallet is recharged (minimum Rs 100). Not verified end to end.
- [x] Order tracking for the customer (status, courier, tracking link)
- [x] Storefront: sign in, register, account, address book, checkout with Razorpay Checkout, order confirmation and detail
- [x] Tests: 20 checkout, payment, webhook, expiry and address tests in the checkout suite against the real test database (Razorpay replaced by a test gateway). Automated.
- [ ] Live Razorpay test payment (test-mode card payment through Razorpay Checkout, confirmed against Razorpay). **Not verified.** No payment record exists in the development database.
- [ ] Live refunds through Razorpay (partial, remaining and full). **Not verified.** The refund logic is covered by automated tests with a recording gateway only.
- [~] Refunds (automated): an admin issues a full or partial refund through the Razorpay Refunds API. Each refund is recorded as pending, processed or failed. The order closes only when processed refunds cover the payment. Staff are read-only and customers have no access. Covered by 29 automated tests. Limitations: a pending refund stays pending until Razorpay confirms its outcome, and there is no manual resolution. See the Refunds section of the README.
- [ ] Guest checkout (checkout requires sign-in for now)
- [~] Server-side bag for signed-in customers: see the Phase 4 note. Automated for the API only.

## Phase 6 — Admin dashboard

- [x] Admin sign-in with role checks (admin and staff; customers are redirected to their account)
- [x] Dashboard: live products, 30-day orders and revenue, awaiting-payment count, low stock, recent orders
- [x] Products: list with search and filters, create, edit, live or draft status, featured flag
- [x] Product photos: direct upload to Cloudinary using a signed request, main photo selection, removal
- [~] Product video: upload with progress, preview with poster frame, replace and remove. Not verified end to end: it needs a real video file and Cloudinary keys.
- [x] Categories: create, nested placement, delete (blocked while subcategories exist)
- [x] Inventory: stock levels, set or adjust with a reason, every change in the audit log
- [x] Orders: list with status filter, detail with customer and courier, status changes that follow the allowed rules
- [x] Coupons: create, pause and resume, usage counts
- [x] Store settings: brand name, tagline, logo, favicon, theme colours, contact details, social links (storefront reads them)
- [x] Homepage banners (hero shows the live banner) and section on/off and order
- [x] Shipping and tax screen with a live preview of what a shopper pays
- [x] Customers list with order count and total spent (paid orders)
- [~] Analytics: API for sales by day for 7, 30 or 90 days (India time), top products by revenue and orders by status. Automated: 5 tests. The `/admin/analytics` page has not been checked in a browser.
- [~] Cloudinary live test: image upload reported working during development. Video upload is not verified end to end.

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

## Deferred engineering work

These items are known and intentionally not implemented in the Phase 2 to 6 checkpoint. None of them is complete.

- [ ] **Safe resolution workflow for stuck pending refunds.** A refund Razorpay never received stays pending indefinitely and blocks further refunds on that payment. Requires a design for a safe manual resolution. Deliberately not automated.
- [ ] **Razorpay refund webhook integration.** Refund status changes are picked up only when an admin presses Check Status.
- [ ] **Refund panel automated UI tests.** The refund panel is checked by typecheck and lint only.
- [ ] **Audit event for pending refund creation.** Only the final outcome (processed or failed) is audited today.
- [ ] **Multiple captured payment handling.** A refund targets the newest captured payment, while the summary totals all captured payments. Not reachable in normal checkout but untested.
- [ ] **Razorpay refund lookup pagination.** The lost-refund lookup reads one list of refunds per payment without paging. It must be checked against Razorpay's list page size.
- [ ] **OrderItem deletion restriction from Phase 3.** Not in this change set.
- [ ] **Wider product variant schema.** Ring sizes and related variants are not designed or built.
- [ ] **`.gitattributes` line-ending configuration.** The repository has none, so Git warns that LF files will become CRLF on Windows.

## Verification notes

- Automated results recorded for this checkpoint are listed under "Last verification" below. They were run only against the isolated `jewellery_test` database.
- Earlier wording in this file claimed a live Razorpay test payment, live partial, remaining and full refunds, a browser check with 26 products, and live Cloudinary video. The repository and the development database hold no evidence for them (the development database has 0 orders and 0 refunds). Those claims were downgraded to "not verified" above. They can be restored only when a recorded test or record exists.
- Test counts within each phase are historical. Recorded at the time of each phase.

### Last verification

Recorded at the end of the checkpoint documentation review. Commands were run from the repository root.

| Check                                                        | Result                                |
| ------------------------------------------------------------ | ------------------------------------- |
| `pnpm format:check`                                          | Pass                                  |
| `pnpm lint`                                                  | Pass (8 of 8 tasks)                   |
| `pnpm typecheck`                                             | Pass (8 of 8 tasks)                   |
| `pnpm --filter @jewellery/storefront test`                   | Pass: 3 files, 16 tests (automated)   |
| `pnpm --filter @jewellery/api test` against `jewellery_test` | Pass: 12 files, 139 tests (automated) |

Automated results are from the test suites only. They do not show live Razorpay, Shiprocket or Cloudinary behaviour, or any browser behaviour. The development database was not used for tests and was not migrated.
