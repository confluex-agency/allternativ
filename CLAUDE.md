# Allternativ

E-commerce + admin dashboard for premium eyewear brand.

## Stack
- **Next.js 16 App Router** (SSR/SSG + API routes)
- **Prisma** ORM + **PostgreSQL** (Supabase)
- **Tailwind CSS** + **shadcn/ui**
- **Zustand** (cart/wishlist) + **TanStack Query** (server data)
- **Stripe Checkout** (multi-currency payments)
- **JWT** auth (HttpOnly cookies, `jose` library)

## Key Conventions
- Prices stored as **cents** (INT) to avoid floating point errors
- `proxy.ts` (not middleware.ts) — Next.js 16 renamed it
- `params`, `searchParams`, `cookies()`, `headers()` are all **async/Promises**
- Storefront routes in `(storefront)/`, admin in `(admin)/admin/`
- Custom analytics tracking: client JS → `/api/tracking` → PostgreSQL → daily aggregation cron

## Commands
```bash
npm run dev          # Development server
npm run build        # Production build
npx prisma generate  # Generate Prisma client
npx prisma migrate dev  # Run migrations (dev)
npx prisma db seed   # Seed database
```

## Project Structure
- `src/app/(storefront)/` — Public store pages
- `src/app/(admin)/admin/` — Admin dashboard
- `src/app/api/` — API routes (auth, products, checkout, tracking, analytics, webhooks)
- `src/components/` — UI (storefront/, admin/, ui/)
- `src/lib/` — Core utilities (prisma, auth, stripe, tracking, utils)
- `src/hooks/` — Zustand stores + auth hook
- `scripts/` — Cron jobs (aggregate-analytics, cleanup-old-events)
- `prisma/` — Schema + migrations + seed

## Deploy
Render.com — 1 web service ($7/mo) + 2 cron jobs (included).
Config in `render.yaml`.

@AGENTS.md
