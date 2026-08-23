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

## Security

### Fixing vulnerabilities

**Never `npm audit fix`**, with or without `--force`. It rewrites the lockfile
broadly and produces a diff nobody can review. Fix with a targeted version bump,
or with an entry in the `overrides` block in `package.json` — the mechanism is
already there.

Pin ranges deliberately. `next` is on `~16.2.12`, not `^16.2.12`: a caret would
let a fresh install on Hostinger pull 16.3.x, a minor nobody tested, and
Hostinger reinstalls on every deploy.

Move together, always: `@prisma/client`, `@prisma/adapter-mariadb` and the
`prisma` CLI. A mismatch between client, engine and adapter fails confusingly.

### Accepted residuals (2026-08-17)

Production went from 16 vulnerabilities to 4. These four stay, on purpose.
**Judge a residual by reachability, not by severity**: can attacker-controlled
input get to this code path in the deployed app? If not, it is accepted, and the
reason is written down.

| Package | Why it stays |
|---|---|
| `deepmerge-ts` (high) | Stack exhaustion merging recursive objects. Arrives through `@prisma/config`, which pins it at **exactly 7.1.5** while the fix needs 8.x. Forcing a major into Prisma's own config loader risks breaking `prisma.config.ts`, which the migration workflow above depends on. It runs when the CLI merges a config file *we* author and commit — no attacker input goes near it. |
| `@prisma/config`, `prisma` (high) | Flagged only because they depend on `deepmerge-ts`. Same reasoning. |
| `fast-uri` (high) | Host confusion in URI parsing. Arrives via `prisma → @prisma/dev → @prisma/streams-local → ajv`. CLI only. |

All four are the Prisma **command line**, not the running server. They show up
under `--omit=dev` only because `@prisma/client` declares `prisma` as a peer
dependency, so npm treats it as production-reachable. Nothing in `src/` imports
the CLI.

**Re-check when Prisma bumps its own pin**, and any time `npm audit` grows a
package that is not on this list.

### Who can reach what

Roles come from section 18 of the client brief. Checked in one place:
`requireRole()` in `src/lib/auth.ts`. Never re-implement a check inline — that is
exactly how `/api/orders` and `/api/customers` ended up with no check at all.

| Endpoint | OWNER | ECOMMERCE_ADMIN | CONTENT_ADMIN | ANALYTICS_VIEWER |
|---|---|---|---|---|
| `POST /api/products` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/orders` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/customers` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/erp/*` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/analytics/*` | ✅ | ✅ | ✅ | ✅ |

401 and 403 mean different things and are returned separately: not signed in
versus signed in without the right role.

Analytics is open to every role, so **nothing customer-identifying may be added
to those payloads**. `/api/analytics/sales` uses an explicit `select` for that
reason; a bare `findMany` returns the whole Order row, shipping address included.

Admin **pages** are guarded by `requireAdminPage()` in `src/lib/admin-guard.ts`,
not by `src/proxy.ts` alone. The proxy only verifies the token signature; it
cannot check `passwordChangedAt` without a database read on every request. Before
the guard existed, a token killed by a password change still opened admin pages
while being rejected by every API route.

### Two things that will bite on deploy

**Login returns 500 in production without Upstash.** `src/lib/rate-limit.ts`
fails closed on purpose: no Redis in production means the limiter throws rather
than silently leaving login unthrottled. The consequence is not "rate limiting is
off", it is **nobody can sign in to the admin**. Configure Upstash before or with
the staging deploy.

**Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in staging.** The default in
`prisma/seed.ts` is committed and therefore in git history.

## Develop against the local database, not Hostinger

```bash
docker compose up -d          # MariaDB 11.8 on port 3307
npx prisma migrate deploy
npx prisma db seed
```

`.env` ships pointing at it. The Hostinger URL is kept in the same file,
commented, as `HOSTINGER_DATABASE_URL`; switching back is uncommenting a line.

**Why this exists.** The shared MySQL user on Hostinger is capped at **500
connections per hour**, and a handful of builds is enough to exhaust it:

```
User 'u..._alt_staging' has exceeded the 'max_connections_per_hour' resource
```

That failure looks alarming and is not a code problem. It is not a production
risk either, because the limit counts *connections* and a long-lived server
reuses its pool. It is a development problem: every `npm run build` prerenders
the product pages and opens connections, and repeated builds add up. Run those
against the container.

The container is pinned to MariaDB **11.8**, the same version Hostinger runs,
with `utf8mb4` / `utf8mb4_unicode_ci` set explicitly — MariaDB 11 would
otherwise default to a different collation than production.

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

**The seed refreshes product copy on every run** while `catalogue-source.ts` is
still the catalogue's source of truth. When the admin CRUD ships, `prisma/seed.ts`
must go back to `update: {}` or it will overwrite what the client edits.

**It deliberately does not refresh stock.** Opening quantities are written on
create only. Re-seeding a shop that has sold something must not put the sold
units back on the shelf.

**Retired rows are DISCONTINUED, never deleted.** Five of the six original models
were placeholders that do not exist, and `Orbital` had two invented colourways
alongside its three real ones. An `OrderItem` may already point at any of them,
and an order must never lose what it was for, so they are deactivated and drop
out of `getLiveProducts()` instead.

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

- **`src/lib/catalogue-source.ts` is the seed's input, and it holds real
  commercial data**: the six model codes, the sixteen colourways and the opening
  stock, taken from the supplier's commercial invoice and the client's written
  answers of 2026-08-20. It used to be called `mock-data.ts`, which invited
  someone to treat three hundred real pairs of stock as sample content.
- `ProductCard` is shared by the home grid and the catalogue. It used to be
  copied into both, which is how they drifted.
- How a card frames its image is **derived** from the image type
  (`MODEL`/`LIFESTYLE` fill the frame, `PRODUCT` sits with air around it), not
  from a hand-set flag.
- Storefront pages are **never pre-rendered at build time**, and this is not
  negotiable on the current hosting. The catalogue is editable from the admin,
  so it cannot be frozen at build time anyway -- but the binding reason is that
  **Hostinger builds the app in a container with no route to MySQL**. The port
  is not reachable from there at all: it is not a remote-access rule that can
  be opened, and it was verified by elimination (from the runtime host,
  `localhost:3306` answers; from the build, neither `localhost` nor the
  external hostname does). Any build that queries the catalogue dies with a
  Prisma `pool timeout ... active=0 idle=0`, which reads like a busy database
  and is in fact a missing route.

  So:

  - `products/[slug]` and `collections/[slug]` return an **empty array** from
    `generateStaticParams`. That is the documented Next.js way to defer every
    path to its first visit while keeping ISR; `revalidate = 60` still governs
    freshness and the shop behaves as before.
  - `/` and `/collections` are `dynamic = "force-dynamic"`. A static route has
    no equivalent escape hatch -- the options are only `auto`, `force-dynamic`,
    `error`, `force-static` -- and letting them pre-render empty would show the
    first visitor a shop with no products.

  ⚠️ **Do not "optimise" this back into build-time pre-rendering.** It will
  pass locally, where the database is reachable, and break the deploy. If the
  build ever moves somewhere with database access, this can be reverted.

### Never invent a specification

The client is explicit: *"no queremos que se infiera ni se invente ninguna
especificación que no esté confirmada por el proveedor. Si alguna especificación
no aparece confirmada, preferimos leave it unpublished."*

Every published spec field is therefore **null** right now, and the seed writes
null on both the create and the update branch so a re-run scrubs anything left
over. `Spec` in `product-purchase.tsx` renders nothing for a null value, so the
product page simply omits the row.

This is not pedantry. The catalogue this replaced carried a frame material, a
lens material, a lens type and **"Handcrafted · LATAM"** on goods manufactured in
Yiwu and Shenzhen. A null field renders as nothing; a wrong field renders as a
claim, and a false origin on a shop that takes money is not a copy problem.

Fill these in only from the supplier documentation the client sends.

### All product photography is a placeholder

There is **no real photography of any Allternativ product yet**, for any of the
six models. Everything under `public/catalog/` is stand-in imagery, and which
folder stands in for which model is arbitrary.

Two rules follow:

1. **Placeholders attach to the product, never to a colourway**
   (`ProductImage.variantId` is null). A photo hung on "Black / Blue" asserts
   that this is what Black / Blue looks like. Hung on the model, it is set
   dressing. `catalog.ts` exposes them as `sharedImages` and every image helper
   falls back to them.
2. **They are all under `/catalog/`, and the real photography will not be**, so
   purging them is one query:
   `DELETE FROM product_images WHERE url LIKE '/catalog/%';`

`Prism` ships as `DRAFT` for this reason: the stand-in folders ran out, and the
only one left was already standing in for `SYNC`. Its codes, colourways and fifty
units are recorded all the same, so the launch inventory is complete.

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

### Delivery, and the two sides of its price

`src/lib/shipping.ts` holds both halves and they are not the same number.

- **What the customer pays** (`quoteShipping`) is the supplier's one-pair rate,
  at cost with no markup, and only ever on a single-pair order. The client asked
  for exactly this: shown separately, calculated by destination, *"no queremos
  incorporar artificialmente el shipping dentro del retail price"*.
- **What it costs us** (`supplierCostUsdCents`) uses the tier for the parcel's
  actual size. A two-pair parcel to Malta costs 18.63 and not the 14.64 of one
  pair; costing it at the single rate understates what the free-shipping rule is
  really spending, which is the one number that rule has to justify.

**From two pairs up, delivery is free and absorbed whole.** That is the client's
AOV lever, and the copy in the cart is theirs word for word.

**The destination is chosen in the cart, before the Stripe session exists.** Not
a preference — Stripe's documentation is explicit that *"the hosted page
integration in Stripe Checkout does not support dynamically customizing shipping
options"*, and we use the hosted page. `allowed_countries` is then pinned to that
one country so the quoted price and the delivered address cannot disagree.

**The exchange rate is frozen**, with its date, because the supplier bills in
dollars and the shop charges in euros. The client already made this same choice
for the far larger number (bought in dollars, sold at a fixed EUR 39), and a
floating delivery price beside a fixed product price would be incoherent. There
is no cushion, so drift lands straight on the bottom line: `npm run fx:check`
reports it, weighted by the orders that actually shipped. Worth a look monthly.

### An order records what it cost, not just what it sold for

`OrderItem` freezes the SKU, the names and the price paid so the catalogue can
change without rewriting history. It now freezes `unitCostCents` too, and the
order carries `shippingCostCents` and `paymentFeeCents` beside them.

Without those, margin could only ever be computed against *today's* supplier
prices, so the first time the supplier raises one, every past order silently
reprices backwards and "what did we make last quarter" starts returning a wrong
number that looks right. It cannot be backfilled: nobody writes down what a
thing used to cost.

⚠️ **`allow_promotion_codes` has no floor.** Codes are created straight in the
Stripe dashboard, without passing through this codebase and without a minimum.
Combined with absorbed delivery, a deep enough code sells below cost — for a
two-pair order to Malta the break-even sits near 66%. The webhook now shouts
when an order closes negative, naming the code. **Shouting is not refusing**;
refusing belongs in the checkout and is not built yet.

### Why the shop cannot oversell

Stock is taken when the **checkout opens**, not when payment lands. Otherwise
minutes pass between "yes, there is one left" and "you paid for it", and
everyone is told yes. See `src/lib/inventory.ts`.

The guarantee is a single conditional statement, not a queue:

```
UPDATE product_variants SET stock_quantity = stock_quantity - n
WHERE id = ? AND stock_quantity >= n
```

If it changed no rows, somebody else won. Condition and write are the same
operation, so no amount of concurrency can produce a negative figure. Verified
against the real database: ten simultaneous checkouts for the last unit, one
winner, no deadlocks.

- Reservations expire after `RESERVATION_MINUTES` (30), matching the Stripe
  session's `expires_at`.
- They are released lazily before every reservation attempt **and** by
  `scripts/sweep-orders.ts`, so the shop recovers even with no traffic.
- Paying after your reservation expired still produces an order, because the
  money is real, and stock is taken late. **Stock may go negative on purpose**:
  it means the shop owes more than it holds, and every further sale of that
  variant is refused until a human intervenes.

### Webhooks are written down before they are acted on

`/api/webhooks/stripe` verifies the signature, stores the event in
`webhook_events`, and hands off to `src/lib/webhooks/process-stripe-event.ts`.
That split is what lets a failed event be replayed from the record.

- Stripe is the durable queue: it retries a 5xx for up to three days, and the
  unique `stripeEventId` makes retries harmless.
- `UnprocessableEventError` marks an event that will never succeed (malformed
  metadata). It is closed as `FAILED` with its reason instead of being retried
  for three days.
- `scripts/sweep-orders.ts` retries recoverable failures and shouts about
  anything still stuck or any negative stock.

A message broker was considered and deliberately not used: overselling is a race
on one row, which the database settles, and durability is already Stripe's job.
Revisit if several independent consumers ever need to react to a sale.

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
