# Allternativ

Premium eyewear e-commerce plus an admin dashboard, built for the Allternativ
brand (Manuel Suarez Bidondo and Belu) by Confluex.

The site is being built against the client's own spec, **"Website & Ecommerce
Structure — Final Draft v2"**. Sections of that brief are referenced by number
throughout the code (`section 07`, `section 22`, and so on). A copy lives at
`Nicolas docs/2026/allternativ/site-preview/a.docx`, and the response we sent,
with the outstanding questions and the delivery order, is in the vault.

## Stack

- **Next.js 16 App Router** (SSR/SSG/ISR + API routes)
- **Prisma 7 + MySQL / MariaDB** via `@prisma/adapter-mariadb`
- **Tailwind CSS** + **shadcn/ui**
- **Zustand** (cart/wishlist) + **TanStack Query** (server data)
- **Stripe Checkout** (hosted page, multi-currency)
- **JWT** admin auth (HttpOnly cookies, `jose`)

## Where things run

| | |
|---|---|
| Production | **Hostinger** Business Web Hosting (Node.js Web App, deploy from GitHub) |
| Previews | **Vercel**, one per branch |
| Database | **MariaDB 11.8.8** on Hostinger (`srv1656.hstgr.io`), `utf8mb4_unicode_ci` |
| Domain | `allternativ.com` — staging goes up first at `staging.allternativ.com` |

Render is no longer used; `render.yaml` is a leftover.

## Database rules that are easy to get wrong

**`prisma migrate dev` does not work here.** It needs to create a shadow
database and the shared-hosting user has no such privilege. The workflow is:

```bash
# 1. edit prisma/schema.prisma, then generate the incremental SQL
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_what_changed
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
  > prisma/migrations/<that folder>/migration.sql

# 2. review the SQL, then apply and regenerate
npx prisma migrate deploy
npx prisma generate
```

`--from-url` was removed in Prisma 7; use `--from-config-datasource`, which
reads the datasource out of `prisma.config.ts`.

**MySQL is not PostgreSQL.** Two traps that fail quietly:

1. Prisma's `String` maps to `VARCHAR(191)`, not to unlimited text. Anything
   that can be long carries an explicit `@db.Text` or `@db.VarChar(n)`. Unique
   and indexed columns stay at 191 on purpose: it is the utf8mb4 index limit.
2. `mode: "insensitive"` is PostgreSQL-only. MySQL already compares
   case-insensitively under the default collation.

**MariaDB stores `Json` as `LONGTEXT`** with a validity check, not as a native
binary JSON type. Fine for our five JSON columns, which are written and read
whole, but do not expect to index inside them.

**The seed refreshes product copy on every run** while `mock-data.ts` is still
the catalogue's source of truth. When the admin CRUD ships, `prisma/seed.ts`
must go back to `update: {}` or it will overwrite what the client edits.

## Conventions

- Prices are **integer cents**. Never floats.
- `proxy.ts`, not `middleware.ts` — Next.js 16 renamed it.
- `params`, `searchParams`, `cookies()`, `headers()` are all **async**.
- Storefront routes in `(storefront)/`, admin in `(admin)/admin/`.
- Custom analytics: client JS → `/api/tracking` → MySQL → daily aggregation cron.

### The catalogue has one vocabulary

`src/lib/catalog.ts` is the **only** source of storefront data, and it speaks
the database's language: a product has `variants`, a variant has `images`, an
image has a `type`. There is deliberately no second set of names.

- **No page imports `mock-data.ts`.** It survives only as the seed's input while
  the client's real catalogue is assembled.
- `ProductCard` is shared by the home grid and the catalogue. It used to be
  copied into both, which is how they drifted.
- How a card frames its image is **derived** from the image type
  (`MODEL`/`LIFESTYLE` fill the frame, `PRODUCT` sits with air around it), not
  from a hand-set flag.
- Storefront pages use `revalidate = 60`. The catalogue is editable from the
  admin, so it cannot be frozen at build time.

### Buying something

- The buyable unit is **`ProductVariant`**, not `Product`. It owns the SKU, the
  stock and, optionally, its own price.
- **Case colour (black/white) is not a variant.** It is an option of the
  purchase, carried on `OrderItem.caseColor` and forwarded to the supplier. It
  does not create a second SKU.
- A cart line is keyed by `lineId` = variant + case colour. The same model with
  two different cases is two lines.
- The checkout **always reads prices from the database**. The cart lives in the
  visitor's browser and can be edited.
- Orders exist only after Stripe confirms payment, and every line stores a
  frozen copy of what was bought (`sku`, `productName`, `variantName`,
  `caseColor`). The catalogue may change afterwards; the order may not.
- Stock is decremented on the **variant**, which is what gets shipped.
- `allow_promotion_codes` is on, so discount codes created in the Stripe
  dashboard work without a deploy.

## Admin roles

Named after section 18 of the brief: `OWNER`, `ECOMMERCE_ADMIN`,
`CONTENT_ADMIN`, `ANALYTICS_VIEWER`. The enum default is `ANALYTICS_VIEWER` on
purpose, so a row created without an explicit role can edit nothing.

## Commands

```bash
npm run dev            # development server
npm run build          # production build (queries the real database)
npx prisma generate    # regenerate the client
npx prisma migrate deploy  # apply migrations (NOT `migrate dev`, see above)
npx prisma db seed     # seed the catalogue
```

## Environment

`src/lib/env.ts` validates on load and throws if anything is missing:
`DATABASE_URL`, `JWT_SECRET` (32+ chars), `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.

⚠️ **Percent-encode the database password.** Hostinger's generator produces
characters such as `?`, `+`, `;` and `>`, and a `?` inside the password ends the
URL's authority section: Prisma then reports `invalid port number`, which points
nowhere near the real cause.

Uploaded admin images **cannot live on the app's disk** — it is rebuilt on every
deploy. Storage provider still to be decided (Cloudinary recommended).

@AGENTS.md
