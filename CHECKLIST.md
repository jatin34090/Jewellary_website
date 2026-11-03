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
- [ ] Install Node.js 22 LTS (local machine has 20.19.4; project targets 22)
- [ ] User approval to start Phase 2

## Phase 2 — Database and backend foundation

- [ ] Design Prisma schema (User, Role, Address, Product, ProductImage, Category, ProductCategory, Inventory, Cart, CartItem, Wishlist, WishlistItem, Order, OrderItem, Payment, Shipment, Coupon, Review, Banner, StoreSetting, AuditLog)
- [ ] Configure Prisma migrations
- [ ] Set up NestJS application (`apps/api`)
- [ ] Health endpoint
- [ ] Authentication (argon2/bcrypt, secure cookies, roles)
- [ ] Swagger documentation at `/api/v1/docs`

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
