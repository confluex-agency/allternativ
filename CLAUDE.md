# Allternativ

Premium eyewear e-commerce plus an admin dashboard, built for the Allternativ
brand (Manuel Suarez Bidondo and Belu) by Confluex.

The site is being built against the client's own spec, **"Website & Ecommerce
Structure — Final Draft v2"**. Sections of that brief are referenced by number
throughout the code (`section 07`, `section 22`, and so on). A copy lives at
`Nicolas docs/2026/allternativ/site-preview/a.docx`, and the response we sent,
with the outstanding questions and the delivery order, is in the vault.

## ⚠️ READ THIS FIRST: where the CURRENT state lives

**This file describes how the shop works. It does not describe what happened
last week.** For that, and before doing anything else on this project, read:

```
../../Confluex-Vault/Proyectos/Allternativ/Estado actual.md   ← start here
../../Confluex-Vault/Diario/<most recent>.md                  ← the session detail
```

⚠️ **This is not a nicety, and skipping it cost a chunk of 2026-09-11.** That
day was spent re-deriving from the database — reading `orders`, querying Stripe,
listing Hostinger's cron jobs — facts that had been written in plain Spanish the
previous evening and committed. Worse, this file *asserted the opposite of
several of them*, because nobody had come back to correct it: it said no mail
provider was wired when one had already sent a real confirmation, and it said
the account had no cron jobs when all three were running.

Two rules follow, and they point in opposite directions on purpose:

- **The vault is the present tense.** What is deployed, what was tested
  yesterday, what the client and the supplier last said, what is still open. It
  is written per session and it is the only thing that is current by design.
- **This file is the standing tense.** Why the code is shaped the way it is, and
  which mistakes not to repeat. It has no dates on most of it because most of it
  should still be true in six months.

⚠️ **When they disagree, neither one automatically wins — go and look.** Both
were wrong at some point on 2026-09-11, and the thing that settled every
argument was the database, the Hostinger panel, the DNS or Stripe's own API. An
assertion in a document is a claim about the world, not the world.

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

Render is no longer used, and `render.yaml` was deleted with it — it was the
only place in this repository that ever scheduled anything, and it described
both the wrong host and, after 2026-09-08, scripts that no longer exist.

### ⚠️ Deploying: what is true no matter what

The push to `main` **is** the deploy. Hostinger builds from GitHub, nobody presses
anything, and it takes about ninety seconds.

⚠️ **The deploy applies no migrations and runs no seed.** Both reach production only
when a person runs them against the database, and forgetting is silent until the new
code touches the new column. **A green build is not a migrated database.**

⚠️ **`STAGING_PASSWORD` is two switches wearing one name**: setting it makes a
deployment private AND unindexable, and it must be ABSENT from production.

**Everything else about deploying is in the `deploy-allternativ` skill**
(`.claude/skills/deploy-allternativ/SKILL.md`): the migration ordering rule and why it
is not symmetrical, what the ninety seconds mean for a route that 404s, why "Rebuild"
in the panel is not a push, what the seed does and does not overwrite, and the whole
reasoning behind the staging password. It is deliberately not loaded into every
session. Read it before any deploy.

### The scheduled work, and why it is an HTTP route

Three jobs have to run on a timer. **The Hostinger account had zero cron jobs**
when this was checked on 2026-09-08, which meant none of them ran anywhere.
**All three exist now** — verified 2026-09-11, on the schedules below, each a
`curl` at `staging.allternativ.com` carrying `CRON_SECRET` — and the last sweep
answered `ok: true`:

| Job | When | What stops without it |
|---|---|---|
| `sweep` | every 15 min | **The confirmation email is never sent.** The database is the queue and this is the only thing that drains it — and `/checkout/success` promises the buyer that mail. **No customer can confirm their email either**, so no account ever sees its own order history. It also releases expired reservations in a shop with no traffic, retries recoverable webhook failures, and is the only thing that shouts about stuck events or negative stock. |
| `aggregate` | daily, 02:00 | `daily_analytics` stays empty, so every analytics figure is blank. |
| `cleanup` | weekly | `tracking_events` grows without limit on a shared plan. |

Note what the sweep is **not**: it is not the safety net for overselling. Stock
is taken by a conditional `UPDATE` when the checkout opens, and abandoned
baskets release themselves on the next purchase attempt. The sweep matters
because a shop with no traffic has no "next attempt", and because **nobody is
told about a stuck payment otherwise**.

⚠️ **They cannot run as scripts on this hosting**, and the two reasons are
independent — fixing one would not have helped:

1. `npx tsx` needs the dev dependencies, and the deploy installs `--omit=dev`.
2. **A cron shell never receives the Node app's environment.** The variables are
   set in the hPanel and injected into the *app* process, so a script started
   from cron has no `DATABASE_URL` at all.

So the logic lives in `src/lib/jobs/`, the app exposes it at
`POST /api/cron/<job>` behind `CRON_SECRET`, and cron is a `curl`:

```
curl -fsS -X POST https://<domain>/api/cron/sweep -H "Authorization: Bearer $CRON_SECRET"
```

The work then happens inside the running server, which already has every
variable. Locally the same jobs run through the CLI, which is the point of
sharing the module: `npm run job sweep`.

- `/api/cron` is in `OPEN_PREFIXES` in `proxy.ts`, alongside `/api/webhooks` and
  `/wp-json`, because the staging password is for humans and this has a secret
  of its own.
- **POST only.** A GET is what a crawler, a link preview or a browser prefetch
  issues, and `cleanup` deletes rows.
- **It fails closed**: no `CRON_SECRET`, no run. Same reasoning as the login
  limiter — this endpoint reprocesses payments.
- ⚠️ **A job that warns still answers 200.** The work ran; a 5xx would make a
  retry re-run a sweep that succeeded. `ok: false` in the body is the signal,
  and Hostinger records the response as the cron's output.

## ⚠️ Going live is not four switches

The selling machinery is finished and the launch still needs a session of its own:
nine steps, none of them code, and **three of them fail silently**. The list, and what
each one costs when it is missed, is in the `deploy-allternativ` skill under
"Going live".


**Still unexercised in the selling path**, and neither needs the client:

- **DELIVERED is written by nobody.** It is in the enum, the dashboard counts it,
  the WooCommerce façade maps it, and no code path sets it — so an order stays
  SHIPPED for ever. Whether the carrier reports delivery through Dianxiaomi is a
  question for **Daniel**, not Max.

**What is genuinely outside our hands:** Stripe in live mode (needs the company
and a bank account), the company's registered details, and `lensCategory` —
which needs one answer from Max about which colourways carry the gradient lens.

## Security

### Fixing vulnerabilities

**Never `npm audit fix`**, with or without `--force`. Fix with a targeted version bump,
or with an entry in the `overrides` block in `package.json`. Pin ranges deliberately:
`next` is on `~16.3.4`, not `^16.3.4`. Move `@prisma/client`, `@prisma/adapter-mariadb`
and the `prisma` CLI together, always.

The reasoning behind each of those three, and what the tilde does and does not stop, is
in the `deploy-allternativ` skill.

### Accepted residuals (2026-09-10)

**Judge a residual by reachability, not by severity**: can attacker-controlled
input get to this code path in the deployed app? If not, it is accepted, and the
reason is written down. Production sits at **9** under `--omit=dev`.

⚠️ GitHub's own count is much higher (65 at the last push) because Dependabot
counts the whole tree, dev dependencies included. The number that describes the
running server is `npm audit --omit=dev`. Neither is wrong; they answer
different questions.

**The Prisma command line — four, unchanged since 2026-08-17:**

| Package | Why it stays |
|---|---|
| `deepmerge-ts` (high) | Stack exhaustion merging recursive objects. Arrives through `@prisma/config`, which pins it at **exactly 7.1.5** while the fix needs 8.x. Forcing a major into Prisma's own config loader risks breaking `prisma.config.ts`, which the migration workflow above depends on. It runs when the CLI merges a config file *we* author and commit — no attacker input goes near it. |
| `@prisma/config`, `prisma` (high) | Flagged only because they depend on `deepmerge-ts`. Same reasoning. |
| `fast-uri` (high) | Host confusion in URI parsing. Arrives via `prisma → @prisma/dev → @prisma/streams-local → ajv`. CLI only. |

All four are the Prisma **command line**, not the running server. They show up
under `--omit=dev` only because `@prisma/client` declares `prisma` as a peer
dependency, so npm treats it as production-reachable. Nothing in `src/` imports
the CLI.

⚠️ npm offers `prisma@6.19.3` as the "fix" for several of these. That is a
**downgrade across a major** from the 7.x line this project runs, and it would
break the client, the engine and the adapter together. It is the resolver
picking the oldest version with no advisory, not advice.

**The database driver — three, and these are new:**

| Package | Why it stays |
|---|---|
| `mariadb` (high) | Three advisories, **no fix published**. The SQL injection needs a `big5`/`gbk`/`sjis`/`cp932`/`gb18030` client charset; ours is `utf8mb4` everywhere, set explicitly in `docker-compose.yml` and on Hostinger. The other two leak credentials to a **man in the middle** — which needs the connection to cross a network. ⚠️ That is the one to re-examine if `DATABASE_URL` in production ever stops being `localhost`: from the app container it is, and the same URL from a laptop is not. |
| `mysql2` (high) | Auth-plugin downgrade and a decompression bomb. Arrives under the adapter, and both need a hostile or intercepted database server. Same reachability argument, same caveat. |
| `@prisma/adapter-mariadb` (moderate) | Flagged only for depending on the two above. |

**Build tooling — two:** `baseline-browser-mapping` and `fflate`, both moderate,
both reached only by a build that runs on our own inputs.

### What was NOT accepted, and why (2026-09-10)

`next` carried a **critical**: two unauthenticated RCEs
([GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36),
[GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)).

By the reachability rule alone it would have qualified as a residual: one only
affects **Windows-hosted** servers and Hostinger is Linux, and the other needs
AVIF in `images.formats`, which is opt-in and which we have never set — the
default is webp only.

**It was patched anyway**, to `16.3.4`, and the reasoning is worth keeping:

- "Not reachable" here rests on **one line of configuration nobody has a reason
  to protect**. Adding `formats: ['image/avif', 'image/webp']` for a page-speed
  win is a change any of us would make without thinking, and it would silently
  re-open a remote code execution on a shop that holds card transactions.
- The residuals above are reachable-by-nobody *structurally* — a CLI that is
  never imported, a charset we do not use. This one was reachable-by-nobody
  *incidentally*.
- The same bump fixed `sharp` (high, libheif) for free, because it is Next's own
  dependency.

The bump also crossed a minor, which the pin exists to prevent by accident. It
was verified first: 58 tests, both type checks, a production build, and the
built server exercised over the storefront, the cart, the admin and the cron
route.

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
| `PATCH /api/inventory/*` | ✅ | ✅ | ❌ | ❌ |
| `/api/admin-users/*` | ✅ | ❌ | ❌ | ❌ |

401 and 403 mean different things and are returned separately: not signed in
versus signed in without the right role.

⚠️ **`/api/account/*` is not in this table and has no role.** Those are the
*customer's* routes, guarded by `requireCustomer()` in `customer-auth.ts`, and
a customer is either themselves or nobody — every query below that point is
filtered by their own id, so there is nothing to be authorised *for*. Never
reach for `requireRole()` there; it reads a different table.

Analytics is open to every role, so **nothing customer-identifying may be added
to those payloads**. `/api/analytics/sales` uses an explicit `select` for that
reason; a bare `findMany` returns the whole Order row, shipping address included.

⚠️ **`include` without `select` returns every scalar column**, not only the
relations it names — and this has now been the same bug in three routes. The
admin order list was fixed on 2026-09-11 (it was shipping the supplier's cost).
`/api/customers` was one route over and was not, so it kept answering with
`password_hash` and `email_verification_token` on every row.

**On 2026-09-12 that stopped being a disclosure and became a takeover.** Password
reset added `password_reset_token`, and that token is not a fingerprint of
anything — it *is* the account: `/api/account/password/reset/confirm` takes it
from anybody, with no session, sets a password and stamps `emailVerifiedAt`.
Every customer who had clicked "Forgotten your password?" within the hour would
have been listed with a live one, readable by any `ECOMMERCE_ADMIN`.

So the query moved to `src/lib/customers-admin.ts` behind a named whitelist,
which is the part that matters: **a column added to `Customer` tomorrow is not
published until somebody decides it should be.** The rule is held by a test that
asserts the *property* — `NEVER_EXPOSED_CUSTOMER_FIELDS` must be absent — rather
than re-listing the fields it expects, because a test that lists them just
agrees with whatever the code does. That is how the first one survived.

Admin **pages** are guarded by `requireAdminPage()` in `src/lib/admin-guard.ts`,
not by `src/proxy.ts` alone. The proxy only verifies the token signature; it
cannot check `passwordChangedAt` without a database read on every request. Before
the guard existed, a token killed by a password change still opened admin pages
while being rejected by every API route.

⚠️ **That same check used to kill the token it was meant to bless.** A JWT's
`iat` is whole **seconds**, floored; `passwordChangedAt` is a millisecond
timestamp. `/api/auth/change-password` writes the timestamp and then signs a
replacement token, whose `iat` floors back to the start of that same second and
therefore lands *before* it — so the fresh token was dead on arrival unless the
change happened exactly on a second boundary. The symptom was quiet enough to
live with: change your password, get bounced to the login page, sign in again,
assume that is how it works. Both `getAuthFromCookies` and its customer
equivalent now allow the one second that is the unit of the comparison.

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
binary JSON type. Fine for our eight JSON columns, which are written and read
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

This is not pedantry. The catalogue this replaced carried a frame material, a
lens material, a lens type and **"Handcrafted · LATAM"** on goods manufactured in
Yiwu and Shenzhen. A null field renders as nothing; a wrong field renders as a
claim, and a false origin on a shop that takes money is not a copy problem.

**Since 2026-09-08 the specs are no longer empty**, and the rule did not bend —
the evidence arrived. Max sent a "Product information" sheet for each of the six
models, and they are transcribed into `SourceSpecs` in `catalogue-source.ts`,
which records for every value which sheet it came from. The seed writes them on
**both** the create and the update branch, so a re-run still **scrubs** anything
that stops being confirmed. `Spec` in `product-purchase.tsx` renders nothing for
a null value, so an unanswered field is simply an omitted row.

What the sheets say and we still do **not** publish:

- **Gender.** They say "Female", "women", "Neutral" and "General" about six
  frames sold as one unisex line. That is the supplier's merchandising category,
  not a property of the object.
- **"Lens Type".** The column holds a material (PC, AC) for three models and
  "HD" or "Clear" for the other three — a marketing word and, on a sunglass, a
  contradiction. The materials go to `lensMaterial`; `lensType` stays null
  rather than republishing the sheet's own confusion.
- **Fit and origin.** Not on any sheet.

⚠️ **`weightGrams` is a `Decimal(4,1)`, not an `Int`.** Amplify weighs 15.4 g and
SYNC 32.7 g; as integers those become 15 and 33, which is *near* what the
supplier wrote. On a published spec, near is the failure. `catalog.ts` converts
it to a plain number — a Prisma `Decimal` cannot cross into a client component.

⚠️ **`lensCategory` is null on all six, and it is the one blank that blocks a EU
launch.** EN ISO 12312-1 requires the filter category to be declared. Max
answered *"black lens for your order are all C3, the gradient lens are C2"* —
two categories split by a property of the **colourway**, and (a) nobody has said
which of our sixteen carry the gradient lens, (b) the column is on `Product`
while the fact is on the variant. Closing it costs one question, then a column
on `ProductVariant`. `tests/catalogue-specs.test.ts` asserts the null so that
filling it in has to be a decision.

⚠️ **A factory colour code in a SKU is a claim too.** `PRISM_C6-DEMI-BLACK` said
C6 while the 3980 chart says C6 is DEMI/**PURPLE** and C4 is DEMI/BLACK — one
string asserting two incompatible things, in the field the warehouse picks by.
It is `C4` now, and the test file carries the chart for the seven colourways
whose SKU embeds a code, so the two can never drift again.

Fill anything still null in only from supplier documentation.

### The product photography, and what a photo on a colourway claims

**Since 2026-09-21 the product pages carry the client's own photography**: renders
made with an image model, delivered in a folder per model. 54 of their 158 are in
`public/products/<slug>/`, converted to webp at 1600 px (121 MB became 3.9 MB). The
list, and which colourway each one is on, is `images` in `catalogue-source.ts`.
The old stand-ins stay in `public/catalog/` and no product uses them.

⚠️ **A photo hung on a colourway is a claim** that this is what that colourway
looks like, so the rules are:

1. A photo goes on a colourway only when that colourway is what it shows.
2. A colourway with photos of its own shows **only those** (`galleryFor`).
3. `colorway: null` is for a photo that is true of the colourways *without*
   photos, and only they see it. Today that is Corinthian's two distant shots,
   for Black / Double Grey, whose frame is the same black.
4. **A colourway with nothing shows a line saying its photography is on its
   way**, never another colour's photo. Orbital Sand Black and Prism Demi / Black
   are in that state, and `tests/catalogue-specs.test.ts` lists them, so filling
   one in has to update the test.
5. The colour badge over the gallery goes only on the colourway's own photos.

⚠️ **"Colour-neutral" turned out not to exist in this set.** The first pass hung
distant rooftop shots on the model for every colourway; at full size the frame's
colour reads in every one of them (a silver Orbital under "Sand Black"). Check a
shared photo at full size before calling it neutral.

⚠️ Not used on purpose: Prism's close-up in a tortoise frame with a **purple**
lens, which is 3980 C6, the colourway Max prepared by mistake and we do not sell.

The seed now deletes and rewrites **all** of a product's images, colourway ones
included. That is safe only while nobody can upload from the admin (E2): the day
they can, it must stop.

`Prism` is still `DRAFT`. It has photos now; what it waits for is Max confirming
the Demi units are the black lens (see its SKU note).

### Buying something

- The buyable unit is **`ProductVariant`**, not `Product`. It owns the SKU, the
  stock and, optionally, its own price.
- ⚠️ **The case colour is a fact of the colourway, not a choice.** Until
  2026-09-24 the shopper picked black or white. Daniel's inventory
  (`skus-allternativ_Manuel.xlsx`, 2026-09-22, confirmed by the client as
  official) holds every colourway in **one** case colour with **no spare
  cases**: white for Corinthian, Neon Shift and Prism, black for Orbital, SYNC
  and Amplify. So the shop had been selling a white-cased Orbital the warehouse
  did not have — the test order `ALT-20260910-1253` was one. Buying spare cases
  to keep the choice was declined for cash flow.
  - It lives on `ProductVariant.caseColor`, written by the seed from
    `catalogue-source.ts`. The page **shows** it; nothing picks it.
  - The checkout and the webhook read it from the **variant**, never from the
    basket: an old basket or an in-flight session may still name the other one.
    A variant with no recorded case is refused, not sold with a guessed box.
  - `OrderItem.caseColor` still freezes it per line, because Daniel's SKU ends in
    it (`ORBITAL_C09-SAND-BLACK_BLACK`) and an order must keep saying what went
    in the box.
  - **`case_stock` is retired.** A case is counted with its pair; the pool is
    neither read nor written, and the table stays only for its history.
    `tests/catalogue-specs.test.ts` carries Daniel's chart (case and quantity)
    so the source file cannot drift from the warehouse.
- A cart line is keyed by `lineId` = variant + case colour, which is now one
  line per colourway; the format stays so saved baskets still load.
- The checkout **always reads prices from the database**. The cart lives in the
  visitor's browser and can be edited.
- Orders exist only after Stripe confirms payment, and every line stores a
  frozen copy of what was bought (`sku`, `productName`, `variantName`,
  `caseColor`). The catalogue may change afterwards; the order may not.
- Stock is decremented on the **variant**, which is what gets shipped.
- Discount codes are still created in the Stripe dashboard, with no deploy, but
  the field the customer types them into is **ours**, in the cart. See below.

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

⚠️ **An order holds at most three pairs** (`MAX_PAIRS_PER_ORDER`, point C3 of the
client's answer of 2026-09-19), so the free window is two to three and there is
no paid step inside an order that can be placed. It replaced "free up to four,
paid from the fifth". It is enforced twice on purpose: `useCart` never lets the
bag grow past it, and `/api/checkout` refuses more, because the bag lives in
localStorage and a basket saved before the cap can still hold five.

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

**A discount code cannot sell below cost, and the check is in the checkout.**
`allow_promotion_codes` used to be on, which put the coupon field on Stripe's
hosted page — and a code applied there lands on a session that already exists,
so it can only be observed, never refused. Combined with absorbed delivery, a
deep enough code sold below cost; for a two-pair order to Malta the break-even
sits near 66%.

The field is in our cart now. `evaluateDiscountForBasket` in
`src/lib/promotions.ts` works out what the order would actually net — revenue
less goods, less what the parcel really costs us, less the processor's fee —
and **refuses** the code below `MINIMUM_NET_CENTS`, before any Stripe session
exists. What Stripe receives is a decision rather than an invitation, and it
rejects a session carrying both a code and the open coupon field anyway.

⚠️ So `allow_promotion_codes` must stay absent from the session. Turning it
back on does not add a feature, it removes the floor.

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

- Reservations expire after `RESERVATION_MINUTES`, which is **40**:
  `CHECKOUT_WINDOW_MINUTES` (30, and the value Stripe's `expires_at` is built
  from) plus `RESERVATION_GRACE_MINUTES` (10).

  ⚠️ This file used to say 30, "matching the Stripe session's `expires_at`",
  and that is the opposite of what the code does on purpose. The reservation
  **outlives** the payment page by ten minutes, and that gap is what makes the
  "paid after the reservation expired" branch in `process-stripe-event.ts`
  unreachable in normal operation — Stripe will not charge an expired session,
  so by the time a payment can land the stock is still held. Believing the two
  are equal would make that branch look like the everyday case and the grace
  period look like dead code.
- They are released lazily before every reservation attempt **and** by
  the `sweep` job (see "The scheduled work"), so the shop recovers even with no
  traffic.
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
- The `sweep` job retries recoverable failures and shouts about
  anything still stuck or any negative stock.

A message broker was considered and deliberately not used: overselling is a race
on one row, which the database settles, and durability is already Stripe's job.
Revisit if several independent consumers ever need to react to a sale.

### A webhook does not exist until somebody creates one

⚠️ A test payment on 2026-08-24 charged EUR 117 and left no order behind. The
cause was not in this code. The Stripe account had **no webhook endpoint
configured at all**: `checkout.session.completed` was emitted with
`pending_webhooks=0` — there was nowhere to deliver it — and since an order is
only ever created by the webhook, there was no order, no stock movement and no
confirmation.

It is silent from both ends. The shopper sees the success page, and
`webhook_events` stays empty. **An empty table means nothing arrived**, not that
something failed.

There are two ways to end up with no events, and they look identical from the
database:

1. No endpoint exists. `stripe.webhookEndpoints.list()` returns an empty list.
2. An endpoint exists but `STRIPE_WEBHOOK_SECRET` is not its secret. The route
   answers 400 at signature verification and **writes no row**, because the
   record is made after `constructEvent`. Stripe shows failed deliveries; the
   database shows nothing.

**Stripe cannot reach a laptop.** Local development needs the forwarder, and
without it a local checkout charges the card and stops there:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

That command prints a `whsec_...` that is **different** from any endpoint's, and
that is the one that belongs in `.env`.

**Staging uses a real endpoint**, at
`https://staging.allternativ.com/api/webhooks/stripe`, subscribed to
`checkout.session.completed` and `checkout.session.expired` and to nothing else
— those are the two `process-stripe-event.ts` understands, and subscribing to
everything just fills `webhook_events` with noise nobody reads. Its secret is a
different value again, and lives in the Hostinger variables.
`STRIPE_WEBHOOK_SECRET` is not a `NEXT_PUBLIC_` variable, so **a restart is
enough**; it does not need a rebuild.

⚠️ **Do not change the Hostinger variables through the API.** That endpoint
replaces the whole set and reads back masked values, so sending one variable
deletes the other thirteen. Edit the single field in the panel.

An old event cannot always be replayed. The metadata freezes `variantId`, and a
re-seeded database no longer has those ids, so `processStripeEvent` closes the
event with `UnprocessableEventError` — which is correct. Test again rather than
trying to rescue the payment.

### The cart crosses to the webhook as metadata, and metadata has limits

The shopper leaves for Stripe's hosted page and comes back as an event, so the
order lines are rebuilt from what travelled on the session. That is
`src/lib/checkout-metadata.ts`, and both sides go through it: the checkout
encodes, the webhook decodes, and the format has one owner.

It has one owner now because it did not before, and the two halves drifted into
two failures that nothing caught.

**A cart of five lines could not be paid for at all.** Stripe caps a metadata
value at **500 characters**, and the whole cart was one value. Measured against
the real SKUs, four lines came to 448 characters and five to 557: Stripe refused
the session, the reservation was handed back, and the shopper saw an error. Free
delivery then ran from two to four pairs, so the large cart was precisely the one
the shop pushed people towards. (Since 2026-09-19 an order holds at most three
pairs, but a three-pair cart can still be three lines, and the split stays.) The payload is now split across `items_0`, `items_1`
… , which puts the ceiling far past the 32 lines the catalogue can even produce.

Two things make the lines small enough for that to be comfortable. `sku` is no
longer written: it was on every line and read nowhere, because the webhook
snapshots `variant.sku` from the database. What remains is the smallest thing
that cannot be recovered later — which variant, how many, and **which case
colour**, the case being an option of the purchase rather than a variant, so
nothing else records it.

⚠️ **A session with no items used to become an order with no lines.** The schema
was an array with no minimum, so absent metadata parsed happily as `[]` and went
straight past the check written to stop exactly that. The handler then matched
zero variants against zero ids, `0 === 0` held, and it wrote a paid order with a
customer, a total and nothing to ship. It was found by a `stripe trigger`, whose
synthetic session carries no metadata — which is the shape of the accident, not
a contrived one. `decodeItemsMetadata` returns null for it, and the event is
closed as `FAILED`.

The decoder reads the numbered keys **by index and stops at a gap**, rather than
scanning the object. Closing a gap would yield a shorter cart that still parses,
and a paid order quietly missing lines is worse than one that fails loudly. For
the same reason the encoder refuses a cart it cannot fit instead of truncating.

The old single `items` key is still read, so a session created minutes before a
deploy still becomes an order.

### The six emails are queued, not sent

The webhook answers Stripe synchronously, and that is what gives the payment
path its durability: a failure returns 5xx and Stripe retries for three days.
The same property is a trap. Anything slow inside that handler turns a 400ms
response into a timeout, and Stripe then retries a payment that **already
succeeded** — leaving the event marked failed for three days because a mail
server was having a bad afternoon.

So the order is written synchronously and the mail is queued on it. The database
is the queue: `Order.emailStatus` is `PENDING`, and the `sweep` job
drains it. No broker, for the same reason there is no broker on the payment
path — one column and one script answer the whole requirement.

There are **six** of them, queued the same way and counted separately. Four are
for customers; two are for staff.

| Mail | Becomes due when | Promised by |
|---|---|---|
| Confirmation | the order is paid | `/checkout/success` |
| Dispatch, with the tracking number | the order is marked SHIPPED **and** has a tracking number | the confirmation email itself, and the client's own point 06 of 2026-08-20 |
| Account verification | somebody registers | the account page, which says the history is waiting on it |
| Password reset | somebody asks on `/account/forgot` | the login page, which now links to it |
| Admin invitation | an OWNER invites somebody on `/admin/users` | nothing — it IS the grant |
| Admin password reset | an admin asks on `/admin/forgot`, or an OWNER sends one from `/admin/users` | the sign-in page, which links to it |

### A seventh, the contact form, and it is shaped differently

`/contact` posts to `/api/contact`, and **the message goes to `info@`, never to
the visitor.** It was a mock until 2026-09-22: "Send" reloaded the page and the
message was lost. The logic is `src/lib/contact.ts`, the table is
`contact_messages`, and it is proved on staging (a message reached `info@`).

- **It tries once immediately, then queues.** The row is written first, and
  "received" is shown only after that. A failed first attempt stays PENDING
  for the sweep, so "received" is always true.
- ⚠️ **No acknowledgement mail to the visitor, ever.** A form that mails the
  address it is given is a relay anybody can aim at a stranger from our sending
  domain, and a burned domain is what puts the order confirmations in spam.
- ⚠️ **Its limiters are `critical`, unlike the other cost guards.** It shares
  the Resend daily allowance with the order confirmations, so an unthrottled
  form spends the buyers' mail. Per IP (3 / 10 min) *and* a global 50 a day,
  because `x-forwarded-for` rotates and only the global one survives that.
- The subject is built from `CONTACT_TOPICS`, a closed list, and the name is
  flattened by `oneLine`. The origin check compares `Origin` with the request's
  own host, not `NEXT_PUBLIC_APP_URL`, so the shop can answer on `www.` too.
- ⚠️ **The sweep counts `contact_messages` every run**, so pushing this code
  before its migration would have broken the sweep for every queue, not only
  this one. Same ordering rule as always: migrate, then push.
- Deleted after `CONTACT_RETENTION_DAYS` by the weekly cleanup; the privacy page
  and the line under the form read the same constant.

### An eighth, the newsletter confirmation (D4), and consent is the product

"STAY ON THE FREQUENCY" is in the footer and as a box in the cart, both with the
client's copy (D4, 2026-09-21). All the logic is `src/lib/newsletter.ts`, the
table is `newsletter_subscribers`. **Nothing sends a campaign yet**; this records
consent, and the proof of it, from launch.

- ⚠️ **The footer is double opt-in.** The row is PENDING until the mailed link is
  clicked, and `consentAt` is the CLICK, not the typing. Without it anybody can
  subscribe anybody, and the first campaign goes to people we cannot show asked.
- **The cart box is single opt-in**, recorded by the webhook inside the order's
  transaction (`metadata.newsletter === "yes"`). The address is the one the
  receipt goes to and the tick came with a payment.
- ⚠️ **The box is unticked and must stay unticked.** A pre-ticked box is not
  consent (Planet49, CJEU 2019).
- ⚠️ **The signup answers identically** for a new, pending or subscribed address.
  Over the per-address limit it also answers "ok". Anything else lets a stranger
  check whether somebody is on the list.
- **This mail goes to an address a stranger typed**, the relay the contact form
  refuses to be. So it carries nothing the visitor wrote, and it has three
  limiters (per IP, per address, per day), all `critical` like the contact form's.
- An UNSUBSCRIBED address typed back in by somebody else **stays unsubscribed**
  until its owner clicks. The weekly cleanup deletes never-confirmed rows after
  `NEWSLETTER_PENDING_RETENTION_DAYS` and **keeps** the ones that said no.
- Confirm and unsubscribe are spent by a **POST from a button**, never by the
  page load (mail scanners), like account verification.
- ⚠️ **`Customer.marketingConsent` (the account page's switch) is NOT this list.**
  Whoever builds the first campaign sender must decide how the two combine, and
  must add a `List-Unsubscribe` header pointing at `/newsletter/unsubscribe`.
- The route tests mock the limiters: `.env` points at the real Upstash, and a
  few runs in a row would otherwise exhaust "3 per 10 minutes".

⚠️ **The fourth is the only one where being LATE is itself the failure.** The
other three carry a message that is still correct a day after it was due; a
reset link is worth a few hours from the moment it is minted, so a sweep that
does not run does not delay this mail, it makes it worthless. The drain
refuses to post a link that has already expired, because "here is your reset
link" followed by "this link has expired" reads to the customer as a shop that
does not work. See "Getting back in" below.

The third one lives on `Customer` rather than `Order` and is the only one with
teeth: until it is clicked, a customer cannot see their own order history. See
"Customer accounts" below.

⚠️ **Separate columns, not a reused one.** An order gets two emails and they
fail independently: the confirmation can be long sent while the dispatch one is
still waiting for the supplier to ship, and one failing must not describe the
other.

⚠️ **`dispatchEmailStatus = PENDING` does not mean "due".** Every paid order
carries it, and most sit there legitimately for days. The sweep asks for the
shipped status **and** a tracking number, so an order marked SHIPPED with
nothing to track never mails a buyer a notification with a blank in it. The
admin says "Not due yet" for the same reason.

`src/lib/email.ts` holds both halves, content and transport.

- **Four states, not a boolean.** `PENDING` / `SENT` / `FAILED` / `SKIPPED`.
  `SKIPPED` exists because the migration has to say something about orders that
  predate the queue, and the honest thing is neither "sent" (nothing was) nor
  "pending" (nobody is going to). Without it, the first sweep after deploy would
  mail every historical buyer a confirmation for a purchase made weeks ago.
- **A missing provider is not a failed order.** `NoEmailProviderError` leaves
  the row exactly as it was and stops the loop, reporting once. Counting it as
  an attempt would march the whole queue to `FAILED` before anyone had chosen a
  provider, and those buyers would then never be mailed even once one existed.
- **A 4xx that is not 429 is permanent.** An unverified domain or a malformed
  address says no again tomorrow; retrying it for days buries the real problem
  inside a queue. Everything else is retried up to `EMAIL_MAX_ATTEMPTS`.
- **The mail is built from the ORDER, never from the catalogue.** The order
  froze the product name, the colourway and the case colour for exactly this
  reason. Reading the live product could describe a different pair.
- ⚠️ **`formatCurrency`, never `formatPrice`.** `formatPrice` rounds to whole
  units on purpose — it is for the shop front — and would turn EUR 15.10 of
  delivery into EUR 15 in a document the buyer holds against a card statement.

### The provider IS wired now, and what that does and does not prove

Checked on 2026-09-11, and it corrects what this file used to say:

- **DNS is in place** on `send.allternativ.com` — the Resend DKIM TXT
  (`resend._domainkey.send`) and the two CNAMEs (`send.send` and `rsend.send`
  → `forge.rmta.net`), exactly the sending-only half described below. The root
  domain's own SPF, DKIM and MX for the founders' mailboxes are untouched,
  which was the whole point of using a subdomain.
- **`RESEND_API_KEY`, `EMAIL_FROM` and `EMAIL_REPLY_TO` are all set** in the
  staging Node.js variables.
- **The three cron jobs exist**, on the schedules this file asks for.

**And a message HAS left.** Staging's one real order,
`ALT-20260910-1253`, carries `email_status = SENT` with `email_attempts = 1`:
the sweep called `sendEmail` once, Resend accepted it, and the row was closed.
The whole path — queue, cron, sweep, HTTPS out of the Node container, API key,
verified sending domain — has run end to end at least once.

⚠️ **`SENT` means Resend ACCEPTED it, not that anybody read it.** It closes the
questions that could break the deployment (is the key live, is the domain
verified, does outbound HTTPS work from cron) and leaves the one that needs a
human: whether it lands in an inbox or in spam. DMARC is still at `p=none`, and
nobody has looked in a real mailbox.

⚠️ **Do not read a quiet sweep as proof of anything.** `drainOrderEmails` only
calls `sendEmail` when the queue has something in it, so an EMPTY queue returns
`ok: true` with `warnings: []` whether the provider works or not — identical to
a revoked key, a typo'd key, or an unverified domain. Absence of the "Email
queue is not draining" warning is not evidence; it only appears once there is
something to attempt. **The evidence is in `orders.email_status`**, not in the
cron's output, and that is the column to look at when somebody asks whether
mail works.

**All four have now left.** On 2026-09-12 an account was registered on
staging and then a reset was asked for, and the sweep answered
`verificationEmailsSent: 1` and, later, `resetEmailsSent: 1`.

| Mail | Proved | How |
|---|---|---|
| Confirmation | 2026-09-10 | order `ALT-20260910-1253`, `email_status = SENT` |
| Verification | 2026-09-12 | `verificationEmailsSent: 1` |
| Password reset | 2026-09-12 | `resetEmailsSent: 1`, the day it shipped |
| Dispatch | 2026-09-24 | `ALT-20260910-1253`, tracking written by Dianxiaomi as an order note, and the mail arrived |

⚠️ **Those counters are evidence, and the distinction matters.** Each one is
incremented only *after* `sendEmail` resolved **and** the row was written `SENT`
— see `drainVerificationEmails` and `drainPasswordResetEmails`. That is not the
quiet-sweep trap described above, which is about an **empty** queue reporting
success whether the provider works or not. A queue with one item in it that
comes back `sent: 1` has actually been through Resend.

All four customer mails have now left at least once.

⚠️ And the question a `SENT` cannot answer is still open for all of them:
whether any of this lands in an inbox or in a spam folder. DMARC is at `p=none`,
and as of 2026-09-12 two real messages are sitting in a Gmail account waiting
for somebody to look.

## The supplier, and how an order reaches him

Dianxiaomi (店小秘) **cannot connect to this shop directly.** It only integrates
with platforms it already knows — Amazon, Shopee, Temu, TikTok Shop, Shopify,
WooCommerce — and a bespoke Next.js shop is not on that list. So there are two
doors, and both exist:

1. **The WooCommerce façade** at `/wp-json/wc/v3/*`, authenticated with
   `WOO_CONSUMER_KEY`. Rather than run a real WordPress alongside this app, with
   a second catalogue to keep in step and a second thing to patch, we answer the
   handful of endpoints Dianxiaomi actually uses. This is the automatic path.
2. **The CSV**, which is the manual one: `/api/erp/export` down, and
   `/api/erp/tracking` up for the sheet the supplier exports.

**Every request to the façade is logged in `woo_request_logs`, including the
routes we have not implemented**, because nobody knew what Dianxiaomi asks for
when it authorises a store. The log is how we found out instead of guessing —
and it is the first place to look when something about the supplier is unclear.

### What is proved, and what is not (checked 2026-09-11)

```
393  GET  /wp-json/wc/v3/orders     auth:yes match:yes → 200   24/08 … 11/09
  2  GET  /wp-json/wc/v3/orders     auth:NO            → 401   24/08
  1  GET  /wp-json/wc/v3/products/0                    → 404   10/09
```

**The outbound half runs in production.** The supplier has been reading orders
without failure for nineteen days; the two 401s are the initial connection
before the credentials were right. And a real order crossed end to end on
2026-09-10 — three pairs, correct SKUs, and the **case colours intact**, which
is the most fragile thing in the chain. (One of those cases, a white one on an
Orbital, did not exist — see "Buying something".)

**The return half ran on 2026-09-23.** Dianxiaomi wrote the tracking as an
order NOTE (`POST /wp-json/wc/v3/orders/{id}/NOTES`, upper case, the number
inside an HTML note with a 17track link), which none of the shapes we had
guessed covered; the façade reads it now. The order went SHIPPED and the
dispatch mail reached the buyer. The loop is closed.

### ⚠️ A test order must say that it is one

On 2026-09-11 the supplier looked at an order that had reached Dianxiaomi
complete and correct and **had to ask whether it was a test.** It was. Nothing
he receives said so.

That question is cheap to ask once and expensive to get wrong once: on a live
shop an unmarked test order is a parcel somebody pays to send to nobody, or a
real order hesitated over because it looked like another rehearsal.

`src/lib/test-order.ts` reads **Stripe's own marker** — a session id starts
`cs_test_` in test mode and `cs_live_` in live — so there is no column of ours to
drift. Test orders are still forwarded, deliberately: refusing to send them would
mean the integration could never be exercised end to end. They are forwarded and
labelled, in the `customer_note` the façade sends (the field the supplier
actually reads; it is the tooltip on his order list) and in the CSV's Status
column, always **in front of** the case colours and never instead of them.

### Tracking, whichever door it comes through

⚠️ **Both doors write the status and the number together, and that pairing is
what the dispatch email depends on.** `/api/erp/tracking` sets `trackingNumber`,
`carrier`, `shippedAt` and SHIPPED in one `updateMany`. The façade goes further
and forces it: if a tracking number arrives and `shippedAt` is null it sets
SHIPPED whatever status the caller sent, because a tracking number means the
parcel left the warehouse and the status field is an opinion.

The field names accepted are a list (`_tracking_number`, `tracking_number`,
`_wot_tracking_number`, `_wc_shipment_tracking_number`, `trackingnumber`, plus
the same shapes inside `meta_data`). **If the supplier sends something else it is
not lost**: the whole body is in `woo_request_logs`, so it is read and the name
added.

---

## The dashboard figures

⚠️ **Revenue is grouped by currency, never summed.** Orders are charged in the
currency of the market they were sold to — EUR, GBP, USD, CAD, AUD, NZD — and
adding `total_cents` across them produces a number with no unit: the kind that
reads fine on a dashboard and is wrong everywhere it gets repeated afterwards.
Until somebody chooses a conversion policy and a rate to freeze it at, one line
per currency is the honest answer. With a single currency it reads as one figure.

- **Net of refunds.** A refunded order is not revenue, and a dashboard that
  counts it is one somebody reconciles against Stripe once and never trusts.
- **"Awaiting dispatch"** — paid and not yet gone — is the only actionable
  figure on the screen: it is the pile that has to reach the supplier.
- ⚠️ **Negative stock is counted apart from low stock**, because it is not a
  worse version of the same thing: it means the shop has taken money for pairs
  it does not hold. `reserveStock` already refuses every further sale of that
  colourway, so it cannot quietly get worse, but it needs a person today. It
  gets its own red panel with the SKUs.
- `LOW_STOCK_THRESHOLD` lives in `inventory.ts` because two screens ask the
  question now, and two numbers meant to be the same number is how a card ends
  up saying "3 low" beside a list of four.

⚠️ Any signed-in admin reaches this screen, `ANALYTICS_VIEWER` included, so
**nothing customer-identifying may be added to it** — the same rule
`/api/analytics/*` lives under. Counts and sums only.

---

## Changing an order from the admin

The only screen in the admin that changes a commercial record, and therefore the
first thing that ever writes to `audit_logs`.

⚠️ **SHIPPED is not a status anybody picks.** See the pairing rule above. A
status dropdown offering SHIPPED would produce an order marked shipped with
nothing to track — skipped by the sweep for ever, no failed row, nobody looking,
and the buyer never told their parcel is moving. That is the worst failure shape
this system has.

So the dropdown offers **PROCESSING** and **CANCELLED** only, and dispatching by
hand is a separate form that **requires** the tracking number.

- `MANUAL_STATUSES` **is** the control, not a UI list: the route's zod enum is
  built from it, so a value that is not on it cannot be expressed by any request.
  It lives in `src/lib/order-status.ts`, which imports nothing — the buttons are
  a client component, and importing it from `orders-admin.ts` pulled Prisma into
  the browser bundle and killed the production build with `Can't resolve 'fs'`.
  Same lesson as `roles.ts` and `auth.ts`.
- **REFUNDED is not on the list.** The money lives in Stripe, and a status
  claiming a refund that did not happen is worse than no status because the next
  person reads it and stops looking.
- **Cancelling does not restock and does not refund.** Both are separate acts.
  The screen says so, because the opposite is the natural assumption.

`recordAudit()` in `src/lib/audit.ts` is the only writer. ⚠️ A failed audit write
does **not** undo the change it describes — a full table must not stop the shop
telling a buyer their parcel moved — but it is loud, because a trail that
quietly stops recording is worse than none: somebody reads the emptiness as
"nothing happened".

---

## The basket panel

`/cart` still exists and is still where the destination and the discount code are
settled. The panel is for deciding fast without losing the page you are on:
before it, adding a pair showed ADDED for two seconds and there was no way to see
the basket except by navigating away — friction at the exact moment somebody has
decided they want the thing, and the moment a second pair is most likely to be
added.

- It carries the **free-delivery line** from `freeShippingMessage()`, the same
  function `/cart` calls, so the client's own copy cannot drift into two
  slightly different sentences. Said here it lands while the visitor is still
  browsing, which is the only moment it can change what they do.
- It shows **where the parcel is going**, because that choice sets the currency
  *and* the only country Stripe's payment page will accept an address in.
- ⚠️ **It does not end in a payment**, and "Proceed to checkout" goes to `/cart`.
  A button that sometimes skipped the page where the country and the code are
  settled and sometimes did not would be a support ticket nobody could reproduce.

The basket is read with `useSyncExternalStore` and a stable server snapshot, not
a `mounted` flag in an effect — the navbar counter already carries the reason,
and here there is a whole list below it.

---

## Customer accounts

The ACCOUNT entry section 02 of the brief asks for. `customers.password_hash`
and `email_verified_at` had been sitting in the schema since the beginning;
what shipped on 2026-09-11 is everything around them — `src/lib/customer-auth.ts`
(tokens, cookie, guards), `src/lib/customer-accounts.ts` (every rule), thin
routes under `/api/account/`, and the pages under `(storefront)/account/`.

**Buying never requires one.** Guest checkout is untouched.

### ⚠️ Registering is usually writing on somebody's existing row

This is the thing to understand before changing anything here. A `Customer` row
is **not** created by signing up — it is created by the Stripe webhook, for
every guest buyer, keyed on the email they paid with. So by the time anyone
registers, that row very often already holds their order history, their
shipping address and their phone number.

Which means: if signing up were enough to read the row, **knowing somebody's
email address would be enough to read what they bought and where it went.**

So it is not enough. `emailVerifiedAt` gates order history, and only a link
sent to the address itself sets it. The check lives **inside**
`listCustomerOrders()`, not in the page and not in the route — one copy, for
the reason the admin side learned when `/api/orders` and `/api/customers`
shipped with no check at all.

`listCustomerOrders` returns **null**, never `[]`, for an unproven address.
"You have no orders" and "we are not showing you these yet" are different
sentences and the screen says both.

⚠️ **The gate covers the row, not just the orders — and getting that wrong is
the mistake this feature actually made.** It shipped with `emailVerifiedAt`
guarding `listCustomerOrders` and nothing else, and a security review found
what that left open. The webhook writes the BUYER's own `name` and `phone` into
the row from `session.customer_details`, so registering with a stranger's
address and any ten characters returned a real person's name and phone from
`GET /api/account/me` — and told you whether that address had ever bought,
because a blank name meant it had not. Now `getCustomerFromCookies` withholds
`name` and `phone` until the address is proved, and `updateCustomerProfile`
refuses to overwrite them. **Anything else added to `Customer` has to answer
the same question before it is returned.**

⚠️ **Verifying kills every session issued before it** (`passwordChangedAt` is
stamped in the same write). That closes an account *pre-hijack*: register with
a victim's address first, the victim gets a plausible confirmation mail, clicks
it, and the click would otherwise prove the address on the row the attacker
holds the password to — handing them the history at that instant, because the
session is re-read from the row on every request. The visible consequence is
that clicking the link signs you out, which is why the verify page says to sign
in again, and why the email says *somebody asked* to create an account rather
than implying the reader did.

⚠️ **So this feature is only as alive as the mail is.** If the queue does not
drain, accounts can be created and used — details, consent, a place to come
back to — but no order history is ever shown to anybody. The sweep shouts about
the backlog every run for that reason.

The provider works: staging's one order was confirmed by email on 2026-09-10
(see "The provider IS wired now" above). What has never run is THIS mail
specifically. **Registering one account on staging and reading
`customers.verify_email_status` afterwards is the test** — it costs no money and
no order. A bad address or a rejected message shows up as a 4xx, which
`outcomeForFailure` treats as permanent and writes into
`customers.verify_email_last_error` — a sentence, not a mystery.

### The two token systems must never meet

Customers and staff both sign in, and **both are signed with the same
`JWT_SECRET`**. Three things keep them apart:

1. Different cookies — `allternativ-customer-token` vs `allternativ-admin-token`.
2. A `typ` claim inside the token, checked on both sides *and* in `proxy.ts`.
   A cookie name is not a security boundary: it is a string chosen by whoever
   sets the cookie.
3. Different tables. No path in `customer-auth.ts` can return an `AdminUser`.

⚠️ **Admin tokens issued before this shipped carry no `typ` and are rejected**,
so everyone signed in at deploy time is signed out once. That is the whole
cost, and it is the right way round.

Verified against the built server: a valid customer token placed in the admin
cookie gets a redirect to `/admin/login` and a 401 from `/api/orders`.

### Things that look like details and are not

- **The email is not editable.** It is the key the Stripe webhook matches
  orders on; changing it silently either hands the account somebody else's
  history or loses its own. Doing it properly means proving the new address
  before the old one stops working, which is a flow of its own.
- **The verification link is spent by a POST, never by the page load.** A GET
  is what a link preview, a corporate mail scanner and a browser prefetch all
  issue, and every one of them would burn the link before the person clicked
  it. Same reasoning as `/api/cron/*` being POST-only.
- **The token is stored as it is sent, not hashed**, because the database is
  the outbox: the row has to be able to produce the link when the sweep runs.
  Exposure is limited by lifetime instead — 32 random bytes, 72 hours, and the
  column cleared in the same write that marks the address proven.
- **`?next=` goes through `safeNext()`, which RESOLVES the value and compares
  origins.** Unchecked it is an open redirect on a shop that takes card
  details, and the victim has just watched a real login succeed on the real
  domain before being handed over.

  ⚠️ It used to reject `//` and `/\` by prefix, and a security review broke it:
  **the WHATWG URL parser strips every ASCII tab and newline from its input
  before parsing**, so `/<TAB>/evil.example` is never a path beginning with a
  slash and a tab — by the time any parser looks it reads `//evil.example`.
  `searchParams` decodes `%09` straight into one, so
  `?next=%2F%09%2Fevil.example` was the whole exploit. A prefix list only
  blocks the shapes somebody thought of; asking the parser blocks the class.
  The test asserts the property (resolve it, stay on this origin), not the
  string each shape returns.
- **The customer password rule is not the admin one.** Ten characters, no
  composition rules. `PasswordSchema` in `auth.ts` is right for an account that
  can change prices and wrong for the public, where composition rules buy
  `Sunglasses1!` and a support email.
- **Consent is still not implied.** The checkbox is off by default and
  `marketingConsentAt` is cleared on withdrawal rather than left behind
  describing a consent that no longer exists (section 25).

### Getting back in: the fourth queued email

⚠️ This section used to say there was no self-service reset and that the login
page admitted as much. **It shipped on 2026-09-12**, once the mail path had been
watched working twice — a confirmation on 09-10 and a verification link on
09-12. The apology on the login page is a link now.

`/account/forgot` asks, `/account/reset?token=` spends, and the queue is the
same shape as the other three: `Customer.passwordResetToken` plus
`resetEmailStatus`, drained by the `sweep`.

⚠️ **The columns are separate from the verification ones, and that is the whole
design.** The two links are not the same kind of object. A verification link can
only ever mark an address proven; **a reset link IS the account** — whoever
opens it chooses the password. Sharing one token column would let a token minted
for the small job be spent on the large one.

Four consequences, each of which is easy to get backwards:

- **The lifetime is 3 hours, not the verification link's 72.** A credential gets
  a credential's life.

  ⚠️ The **floor** is peculiar to this shop: **the database is the outbox and
  the sweep is the postman**, so a link is minted now and posted up to 15
  minutes later. A lifetime near the sweep interval mails people links that
  expired in the queue. `PASSWORD_RESET_TTL_MINUTES` against
  `SWEEP_INTERVAL_MINUTES` is asserted in the tests as a *relationship*, so
  shortening it past the postman fails there instead of failing a customer.

  ⚠️ **The ceiling was wrong first, and the correction is the lesson.** It
  shipped at 60 minutes, reasoned entirely from the floor and from "this is a
  credential". The first person to test it end to end asked for a reset, was
  called away, came back, and found the link dead — which is not an edge case
  but the ordinary shape of the event: somebody asks from a phone, mid-something
  else, and reads the mail later. **A lifetime chosen only from the threat model
  had no idea what people do.** The security cost of the longer window is small
  because the other two properties do the real work — the link is single-use and
  any newer request kills it — so what changes is only how long something usable
  sits in a mailbox that its owner could re-mint from anyway.
- **A reset proves the address.** Receiving mail at an address and using what it
  contained is the same proof the verification link asks for, delivered by a
  stronger act, so `emailVerifiedAt` is stamped and order history opens. The
  pending verification token is cleared in the same write, or an older link
  could later re-stamp the row and sign the person out for nothing.
- ⚠️ **The request endpoint answers identically to everybody** — `200
  {queued:true}` for an address with an account, one that only ever bought as a
  guest, one nobody has seen, and a string that is not an address at all. It is
  unauthenticated and takes an email, so any difference at all makes it an
  enumeration oracle. `requestPasswordReset` returning null is deliberately not
  looked at in the route: there is nothing to branch on, so nobody can add a
  branch later. Rate-limited on **two** keys — by address (or one attacker
  mail-bombs one inbox in our name) and by IP (or one machine walks a list).
  Yes, `registerCustomer` already leaks the same bit; that is a documented trade,
  not a licence to open a second oracle with a different limiter key.
- ⚠️ **The confirm endpoint checks length and NOT `passwordIsTooCloseToEmail`**,
  unlike registration. That check needs the account's address, and this is the
  one flow where the holder may not have it: a stolen link lets somebody set a
  password but not sign in, because signing in also needs the address. Answering
  "too close to your email" would leak that address back a guess at a time.

**Nobody is signed in afterwards.** The reset moves `passwordChangedAt`, which
kills every session that existed before — including the attacker's, which is the
point. Minting a fresh token in that same instant is the exact `iat`-floor
collision documented above, so the screen says to sign in instead. Verifying
already behaves this way, so the two now read alike.

### Still not built

Wishlist persistence, an address book, and signing in *during* checkout — the
cart and the wishlist remain in the browser exactly as before.

## Admin roles

Named after section 18 of the brief: `OWNER`, `ECOMMERCE_ADMIN`,
`CONTENT_ADMIN`, `ANALYTICS_VIEWER`. The enum default is `ANALYTICS_VIEWER` on
purpose, so a row created without an explicit role can edit nothing.

### ⚠️ An admin who forgets their password must have a way back

Shipping invitations on 2026-09-13 left none, and the shape of that is worth
keeping because it was invisible from inside the feature that caused it.
`/api/auth` had only `change-password`, which requires being signed in — fine
while there was ONE account whose password lived in somebody's manager.
Invitations changed the picture without touching that route: several people
with their own accounts, and `inviteAdminUser` refuses an address that already
exists, so an OWNER could not even re-send. **Locked out permanently, recoverable
only by SQL run by hand.** Section 18 asks for it in as many words: *"Password
reset and appropriate authentication/security controls."*

Two doors now, and they are not redundant:

- **`/admin/forgot`**, self-service. Needed because if the person locked out is
  the OWNER, there is no other OWNER to rescue them — that would make the
  grantor a single point of failure for their own account.
- **"Send reset link" on `/admin/users`**, for the ordinary case where somebody
  asks you.

⚠️ **Which link goes out is decided by the ROW, never by the caller.** An account
that never accepted gets a fresh INVITATION; one with a password gets a RESET.
If the screen could choose, it would be possible to tell somebody who has had
access for a month that they have just been granted it — not a typo, but telling
them something happened to their account that did not.

⚠️ **`/api/auth/reset` answers `{queued:true}` to everybody**, and this matters
more than the customer equivalent. A staff endpoint that distinguished "no such
admin" from "wrong password" lets anybody enumerate **who works here**, which is
where every targeted phish starts — and the login route already answers all its
refusals identically, so a difference here hands back exactly what that protects.

The TTL is **2 hours**: under the invitation's 24 because the account is live,
over the customer's 3 because it reads orders and prices, and comfortably over
the sweep interval because the sweep is the postman.

### There is no admin sign-up, and there must never be

⚠️ **The default role is the reason.** `ANALYTICS_VIEWER` can read every
dashboard in the business, so a self-registration form would hand the company's
numbers to whoever typed an email address. An admin row is created by an OWNER
or it does not exist.

Until 2026-09-13 there was exactly one way for one to exist — the seed made it —
which is why there had only ever been one. `/admin/users` is the door now:
OWNER-only, it invites by email, and the person sets their own password through
a link. `src/lib/admin-users.ts` holds every rule.

- **`AdminUser.passwordHash` is nullable, and the null means "invited, has not
  chosen a password yet".** Every path that authenticates reads it that way,
  exactly as `Customer.passwordHash` null means "guest, never registered".
- **The invitation token is never returned by the API.** Handing it back would
  let an OWNER paste the link into a chat, which quietly undoes the point of
  mailing it: accepting is what proves the person controls the address the
  account is named after.
- **Admins are deactivated, never deleted** — the rule retired products follow.
  `AuditLog` freezes `adminEmail` as a string so the trail survives either way,
  but a deleted row makes "who is this person in the log" unanswerable, and
  being able to ask that later is the whole point of keeping it.
- **Twenty-four hours on the link**, against the customer reset's three. Not
  because it is worth less — it is worth far more — but because an invitation
  arrives *unannounced*, at somebody who was not waiting for it and has no idea
  it is time-limited. Same lesson as 2026-09-12, applied before it cost anything.

### ⚠️ Two things that were harmless until roles became editable

Both were fine while there was one admin whose role never changed, and both are
wrong the moment an OWNER can grant and revoke.

1. **`getAuthFromCookies` used to return the role from inside the TOKEN.** A JWT
   is a snapshot of what was true when it was signed — stale *and* authoritative
   at once. Demote somebody from OWNER and their cookie would keep saying OWNER
   for up to seven days, across every `requireRole` in the app. **The role now
   comes from the row**, which costs nothing because the same read already
   happens for `passwordChangedAt`, and which means a promotion or a demotion
   takes effect on the next request without signing anybody out.
2. **Deactivation has to bite immediately**, not when the cookie expires — that
   being the one time anybody deactivates an account in a hurry. Checked in the
   guard (for the live session) *and* in the login route (so they cannot come
   back in).

### ⚠️ The last OWNER cannot be demoted or deactivated

OWNER is the only role that can grant roles. So stranding the last one means
**nobody can ever grant anything again**, and the only way back is a person
running SQL against production by hand. Two ordinary routes there: an OWNER
tidying up their own account, and an OWNER demoting the *other* OWNER without
noticing they were the remaining one. `wouldStrandTheBuilding()` refuses both.

⚠️ **An invited OWNER who has not accepted does NOT count as a way out.** They
have no password, so they cannot sign in, so they cannot grant. Treating a
pending invitation as cover is how the building gets locked with the key still
in the post.

⚠️ That guard is **global by nature** — it counts every active owner in the
database — so it cannot be tested against a private copy. The test borrows the
seeded owner and puts it back, the way `captureCaseStock` borrows the case-stock
singletons. The first version of that test failed all three assertions, and the
guard was right: this is exactly the shape of a test somebody "fixes" by
weakening the thing it checks.

## Changing stock by hand

`/admin/products/[slug]` has been read-only since it was built; **stock became
editable on 2026-09-13 and everything else on that page did not.** The line is
not arbitrary.

⚠️ **The claim that the whole screen was blocked by `prisma/seed.ts` was only
half true, and the half matters.** The seed replays `catalogue-source.ts` over
the product COPY and `Product.priceCents` on every run, so a form for either
would lose work. It does **not** touch `stockQuantity` — that is written on
create only, precisely so re-seeding a shop that has sold something cannot put
the sold units back — and `market_prices` already upserts with `update: {}` for
the same reason. So stock was never blocked; the copy and `priceCents` still
are. The **market prices** became editable on 2026-09-24 (C5), see below.

### ⚠️ Why this is not a "set stock to N" form

Stock is taken by a conditional `UPDATE` when a checkout opens, and that single
statement is the entire guarantee against overselling.

A naive form breaks it silently. Somebody opens the page at 12, two sell while
they are typing, they submit "12" meaning *leave it alone* — and the write puts
12 back, **un-selling a pair the shop has already been paid for**. No error, no
failed row; it surfaces when a parcel cannot be packed.

So `src/lib/inventory-admin.ts` never writes a number it did not check:

| | |
|---|---|
| `adjustVariantStock` | a **delta** — "twenty arrived", "two damaged". Composes with whatever sold meanwhile. |
| `setVariantStock` | the counted figure **plus the number the person was looking at**. If the row moved, it refuses and hands back reality. |

⚠️ **A negative delta cannot take stock below zero.** Negative stock has one
meaning here — the shop has taken money for pairs it does not hold — and
`reserveStock` refuses every further sale of that colourway on the strength of
it. A typo must not be able to manufacture that state; only a real sale may.
Correcting a genuine oversold is done by *adding* what arrived.

⚠️ **The reason is mandatory, and it is the field somebody will want to remove.**
The question asked three weeks later is never "what is the stock", it is "why is
this eleven when the invoice says twelve" — and an audit row reading `11 → 12`
with no sentence answers nothing.

### Prices and promotions (2026-09-24), and the one rule they share

**Neither may make an order lose money**, and both are checked with the same
arithmetic the checkout uses (`margin.ts`), through `basketsAt()` in
`src/lib/prices-admin.ts`: every shippable country of a market × every order
size the shop accepts.

- **Market prices (C5)** are edited on `/admin/products/[slug]`. The edit goes
  to the **whole line** by default, because the client prices one figure per
  market ("no hay ningún colourway premium ni diferencia de precio entre
  modelos"), and it is refused unless every model currently shows the figure
  the person was looking at. The same stale-write rule as stock, and a reason
  on every change. A price whose worst order nets below `MINIMUM_NET_CENTS` is
  refused. The shop pages are revalidated on save.
- ⚠️ **`Product.priceCents` is still not editable**: the seed replays it. It is
  only the fallback for a market with no row, and every product has all six.
- **Promotions** are on `/admin/promotions`, a screen **over Stripe's API**, not
  a table of ours. A second brief (2026-09-14) asked for "an internal database
  collection for active discounts", and that part was **declined**: it would
  take on what Stripe does for free (expiry, redemption limits, first order
  only) and, worse, computing the charged amount ourselves and counting
  redemptions against a race shaped like overselling.
  - Before a code exists the screen says **which baskets it would be refused
    on**, per market. The checkout still refuses them one by one
    (`evaluateDiscountForBasket`); this asks the same question in advance, so a
    code is not published on Instagram and then called "not valid" in Malta.
  - **Only percentage codes are created here.** A fixed amount is one currency
    and the shop sells in six. Existing ones are listed and can be switched off.
  - One coupon per code, `duration: once`. The promotion code is created with
    `promotion: { type: "coupon", coupon }` — the shape of API version
    `2026-02-25.clover`, which is not the one most examples online show.
- Both write to `audit_logs`, and both are COMMERCIAL_ROLES.

### What the video brief asked for, and what was refused

A reference video (2026-09-13) described a stock-and-orders admin. Most of it
already existed; three things were deliberately **not** taken:

- **"Total Gross Sales Revenue" as one figure.** Six currencies; see the
  dashboard rules above. Ours is grouped and net of refunds.
- **A status dropdown offering Shipped and Delivered.** See "Changing an order
  from the admin" — SHIPPED is what a tracking number *means*, and a status
  picker that can reach it produces orders the dispatch sweep skips for ever.
- **"Populate the entities with mock data and orders."** `catalogue-source.ts`
  holds real commercial data — the file was renamed *from* `mock-data.ts`
  because that name invited exactly this. Mock orders would also pollute the
  margin figures and the ERP feed the supplier has been reading since 24/08.

### ✅ Decided 2026-09-14: shoppers never see the stock number

Raised as an open question when the video brief assumed it, and **answered no**.
"3 left" is a scarcity lever, but it publishes the inventory position — on 300
total units it tells a competitor exactly what was bought. Sold-out marking
stays; the figure is for the team.

⚠️ **Do not add it back as a conversion experiment without asking.** It reads
like a pure UX tweak and it is a disclosure decision.

⚠️ And note what the ask underneath it actually was: *"así ven qué lentes se
venden más"*. **That is a reporting question, not a stock-display one** — and it
is not answered by a number on a product page, which shows what is LEFT rather
than what MOVED. Twenty units left says nothing without knowing whether it
started at twenty-five or a hundred. The honest answer is `/admin/analytics`
(2026-09-24): pairs sold beside what is left, sell-through, and the sold-out
views that say what to reorder.

## The admin screens (2026-09-24)

Every screen the sidebar ever promised exists now. Who reaches each one:

| Screen | Roles | Why that line |
|---|---|---|
| Dashboard, Products, **Analytics** | every admin | counts and sums, nothing customer-identifying |
| Orders, **Customers** | COMMERCIAL | personal data |
| **Promotions**, **Costs & margins** | COMMERCIAL | a price cut; what the shop pays and keeps |
| **Activity** (`audit_logs`) | COMMERCIAL, staff rows OWNER-only | stock, prices, orders; who was granted what is the OWNER's business |
| People | OWNER | it decides every other row of this table |

- ⚠️ **Analytics mixes two populations and says so.** Orders are every buyer;
  visits and events are only visitors who accepted analytics cookies. They are
  never divided into a single "conversion rate". `analytics-report.ts` is held
  by a test that asserts the buyer's name, email and phone appear nowhere in it.
- ⚠️ `trackProductView` existed from the start and **nothing called it**, so
  the funnel began at a zero. It fires from `ProductPurchase` now.
- ⚠️ **Two columns sum across currencies and must not be displayed**:
  `daily_analytics.total_revenue_cents` and `Customer.totalSpentCents`. The
  screens group by currency from the orders instead.
- **Costs & margins reads the FROZEN costs** on each order, never today's
  catalogue. A null cost is "unknown" and the order is left out of the totals,
  never counted as free. It also shows the six prices in USD (have they drifted
  apart?) and the frozen FX against today's (frankfurter.dev, cached a day).
- **Customers** says whether a person registered as a yes/no computed in
  `customers-admin.ts`; the hash never leaves the database.

## Commands

```bash
npm run dev            # development server
npm run build          # production build (queries the real database)
npm run typecheck      # the app AND the scripts -- see below
npm test               # vitest; borrows the local database, see below
npx prisma generate    # regenerate the client
npx prisma migrate deploy  # apply migrations (NOT `migrate dev`, see above)
npx prisma db seed     # seed the catalogue
npm run job sweep      # run a scheduled job locally (sweep|aggregate|cleanup)
```

⚠️ **`tsc --noEmit` on its own does not check `scripts/` or `prisma/seed.ts`.**
They are excluded from `tsconfig.json`, and that exclusion is deliberate:
`next build` consumes that file, Hostinger rebuilds on every deploy, and a
mistake in a cron script should not fail a production build. But excluded from
the build is not the same as unchecked, and for a while it was — a duplicate
`const` in what was then `scripts/sweep-orders.ts` passed the type check and
only surfaced when the script ran, which for a cron job means finding out in
production.
`tsconfig.scripts.json` covers them, and **`npm run typecheck` runs both**. Use
it rather than `tsc` directly.

⚠️ **The test suite writes to the database in `DATABASE_URL`.** It makes its own
products, prefixed per run, and cleans them up. The exception is `case_stock`,
which is a singleton keyed by colour: the purchase path reserves against BLACK
and WHITE, the same two rows the shop sells from, so the suite cannot have a
private copy. It borrows them and puts them back in `afterAll`
(`captureCaseStock` / `restoreCaseStock` in `tests/helpers.ts`).

Before that, a run of the suite quietly reset both pools to 100. After a test
purchase had correctly taken three black cases and two white ones, the next
person to look saw stock that had apparently un-sold itself — a convincing
inventory bug that was nothing of the sort. One more reason not to point
`DATABASE_URL` at Hostinger.

## Environment

`src/lib/env.ts` validates on load and throws if anything is missing:
`DATABASE_URL`, `JWT_SECRET` (32+ chars), `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.

⚠️ **`NEXT_PUBLIC_APP_URL` is the post-payment address, and it is baked in at
build time.** It is what `success_url` is built from, so it is where Stripe
returns a shopper *after* charging their card. Staging shipped once with the
development value still in it: the money was taken and the browser was sent to
`http://localhost:3000`, a blank page on the customer's machine. Nothing threw
and nothing logged — the only trace was in Stripe.

`env.ts` now refuses to load on a loopback or non-https value when
`NODE_ENV=production`, so the mistake fails the build instead of the checkout.
Three consequences:

- **Set the variable before deploying**, not after. A deploy with it wrong now
  fails at "Collecting page data" rather than going live broken.
- **Correcting it in the host's panel is not enough — the app must be REBUILT.**
  `NEXT_PUBLIC_` variables are inlined into the bundle at build time, so a
  restart re-runs the same compiled wrong value. This is the part that sends
  people hunting for the bug in the wrong place.
- A **local production build** therefore needs a real address:
  `NEXT_PUBLIC_APP_URL=https://staging.allternativ.com npm run build`. `npm run
  dev` is unaffected, because the guard only applies in production.

⚠️ **Percent-encode the database password.** Hostinger's generator produces
characters such as `?`, `+`, `;` and `>`, and a `?` inside the password ends the
URL's authority section: Prisma then reports `invalid port number`, which points
nowhere near the real cause.

## The provider the client still has to choose

**Image storage — and ⚠️ it blocks LESS than this said until 2026-09-14.**

This used to read "this blocks more than it used to: there is real product
photography waiting". That was wrong, and it was wrong in the expensive
direction — it parked the launch photography behind a provider decision it never
needed.

**Two different problems were being treated as one:**

| | |
|---|---|
| Getting the launch photography live | **Not blocked.** Commit it, like `public/catalog/` already is — 80 files, 3.4 MB of webp, in git, served as static assets. |
| Letting the founders upload a photo from the browser | **Blocked**, and this is the real E2. Section 19 asks for it: upload, replace, reorder, assign to a variant. |

⚠️ **What genuinely cannot work is writing to the app's disk at runtime**, and
the mechanism is worth knowing rather than guessing at. Hostinger runs the app
through Passenger from `hbuilds/current/nodejs`, where **`current` is a symlink**
that each deploy repoints at a freshly built directory. A file written into the
running app is therefore not deleted — it is *orphaned* in the previous build the
moment that symlink moves, and pruned later. The `.htaccess` in `public_html`
survives because it is the Apache document root, which is a different place from
the app.

So Cloudinary is still the recommendation **for the upload feature**, and it is
not on the critical path to selling. Photography that arrives as files goes in
the repo; convert it first — the current set came down from 195 MB to 3.4 MB.

### Transactional email — chosen and configured, kept here for the reasoning

⚠️ This section used to say email was still to be decided. **It is decided:
Resend, on `send.allternativ.com`, and the DNS and the keys are in place** (see
"The provider IS wired now" above for what was actually verified, and for the
one thing that has not been).

The reasoning is kept because it is the argument against the alternative that
keeps suggesting itself — **Hostinger's own SMTP, which is free and already
paid for.** Hostinger email *is* configured on the domain, MX to
`mx1/mx2.hostinger.com` with its own SPF and DKIM and DMARC at `p=none`. But
that is *mailbox* hosting, for people writing to people. A confirmation for an
order that was just charged is a different job: it needs per-message logs,
bounce and complaint webhooks, and its own reputation, because a confirmation in
the spam folder reads to the buyer as "my order failed".

And one thing more, which is the part that would be discovered too late:

- The strongest argument is infrastructure, not marketing: Resend is an **HTTP
  API, not SMTP**. Outbound HTTPS from the Hostinger Node container is
  verified — that is how Stripe is called. Whether outbound SMTP ports are open
  from there is **unknown and untested**, and an HTTP API never has to find out.
- **On a subdomain** because the root SPF authorises only Hostinger today.
  Editing it means touching the record the mailboxes depend on, and SPF has a
  ten-lookup limit. A subdomain also keeps the two reputations apart.

⚠️ **That port question is still unanswered, and it is why "just use the mail we
already have" should stay answered with no.** Switching to Hostinger SMTP would
mean adding an SMTP client (nodemailer, a dependency this project does not
have), writing a second transport beside the one that already works, and only
then finding out whether port 465 or 587 is even reachable from the Node
container. The HTTP path is built, configured and never has to ask.

If it ever does come up again, settle the port first — a cron job running
`timeout 5 bash -c '</dev/tcp/smtp.hostinger.com/465'` answers it for the price
of one line, and `EMAIL_FROM` would then have to move back to the root domain,
whose SPF would need editing. That is three reversals to gain nothing.

⚠️ `EMAIL_FROM` must be an address on the verified domain — never a personal
Gmail. And on a sending subdomain that address **does not receive**: sending and
receiving are configured separately, the subdomain only ever gets the sending
half (a DKIM record and two CNAMEs), and with no MX and no address record a
buyer who hits reply gets a bounce. Switching receiving on would not help — it
points the subdomain at the provider's inbound handling rather than at a person,
trading a bounce for a message nobody reads. People do reply to order
confirmations; it is often how a shop first hears "wrong address" or "cancel
this". `EMAIL_REPLY_TO` points back at the real Hostinger mailbox on the root
domain.

@AGENTS.md
