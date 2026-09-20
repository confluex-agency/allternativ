---
name: deploy-allternativ
description: The full deploy procedure for this shop - migration ordering, what the deploy does NOT do, the go-live list whose three steps fail silently, and how dependencies are fixed. Read it BEFORE any push to main, before any migration, before going live, and when told "deploy", "subir a produccion", "lanzar", "ship it", "release". The push to main IS the deploy, so there is no undo. Trigger in English and Spanish.
---

# Deploying Allternativ

This was carved out of `CLAUDE.md` on 2026-09-21. It is the same text, word for word,
moved here because it is a procedure: needed in full on the day of a deploy, and dead
weight in every other session. `CLAUDE.md` keeps the three facts that are true always
and points here for the rest.

⚠️ **The push to `main` IS the deploy.** There is no button and no undo. Read this
before pushing, not after.

---

## Migrations, the seed, and the staging password

### ⚠️ Nothing in the deploy applies migrations

Hostinger's build runs `npm install` (whose `postinstall` is `prisma generate`)
and then `next build`. **It never runs `prisma migrate deploy`, and it cannot**:
the build container has no route to MySQL, which is the same constraint that
keeps the storefront off build-time pre-rendering.

So a migration reaches production only when a person runs it, and forgetting is
silent until the new code touches the new column. On 2026-09-10 a deploy went
out green with two migrations unapplied; the first request to the sweep answered
`The column orders.email_status does not exist in the current database`, and
until then everything looked fine.

⚠️ **A green build is not a migrated database.** From a machine that can reach
the database:

```bash
# .env keeps the production URL commented as HOSTINGER_DATABASE_URL
DATABASE_URL="<the Hostinger URL>" npx prisma migrate status   # read-only, check first
DATABASE_URL="<the Hostinger URL>" npx prisma migrate deploy
```

This is the one routine reason to point at Hostinger rather than the container.
It is a handful of connections, nowhere near the 500-per-hour cap that makes
*builds* against it a bad idea.

#### ⚠️ Run it BEFORE the push, not after

This section used to say "after any deploy that carries a new migration", and
that is the wrong way round for every migration this project has actually
shipped. **The two orders are not symmetrical:**

- An **additive** migration — a new nullable or defaulted column, a new index,
  a new table — is invisible to the code already running. Applying it first
  costs nothing and there is no window at all.
- The **new code against the old schema** is not survivable: it answers
  `The column ... does not exist`, on the first request that touches it.

So migrating first closes the window; migrating after opens it and leaves it
open for however long it takes somebody to remember. On 2026-09-12 both of the
day's migrations were applied before the push for this reason, and staging never
served a request against a schema it was ahead of.

⚠️ The rule flips for a **destructive** migration — one that drops or renames a
column the running code still reads. There the old code is what breaks, so the
deploy goes first and the migration follows. Nothing in this project has needed
one yet; if one does, it is two deploys, not one.

#### ⚠️ The push is what deploys, and it takes about ninety seconds

Hostinger builds from GitHub on push to `main`. Nobody has to press anything —
and pressing "Rebuild" in the panel is **not** the same thing: it rebuilds the
copy it already had (learned 2026-09-10).

Verified twice on 2026-09-12: a push at 10:21:36 UTC finished building at
10:22:42, and the second one took about a minute and a half from `git push` to
the new route answering. **A route that 404s immediately after a push has not
failed yet** — check `hosting_listNodeJSBuildsV1` for the build state before
going looking for a bug.

#### ⚠️ `STAGING_PASSWORD` is two switches wearing one name

`isStaging` is just `stagingPassword.length > 0`, and `robots.ts` reads it:

```ts
if (isStaging) return { rules: [{ userAgent: "*", disallow: "/" }] };
```

So setting that variable makes a deployment **private AND unindexable**, and
clearing it makes it **open AND indexable**. They were tied together on purpose,
so that nobody could leave a preview half-exposed. The consequence is that the
obvious-looking small favour — *"take the password off so the founders can browse
without the prompt this week"* — also invites Google into a half-built shop under
the brand's own name, with placeholder photography and legal pages that say "not
final". That outlives the staging server by months, and when the real domain
launches it is **the same content on two hostnames**, with the older one already
indexed.

Asked and declined on 2026-09-14: the password stays, because a browser
remembers it after the first prompt and the friction is one dialog a week.
⚠️ **Any username works** — the check reads everything after the first colon, so
only the password matters. Worth saying when handing it to somebody, because the
two-field dialog implies otherwise.

If it ever does need to come off while staying unindexed, do not just delete the
variable: split the two meanings first, and derive the noindex from
`NEXT_PUBLIC_APP_URL` rather than a new flag of its own. That variable is already
required, already validated, and already has to be right for the checkout to
work — so it is the one signal here that cannot be quietly forgotten.

⚠️ **And the reverse is the launch-day trap.** `STAGING_PASSWORD` must be ABSENT
from the production deployment. Carried over, the real shop asks every customer
for a password and tells Google not to index it — invisible, on launch day, with
nothing in any log to say so.

⚠️ **The same is true of the seed.** Nothing in the deploy runs it either, so a
change to `catalogue-source.ts` — a corrected SKU, a newly confirmed spec —
reaches production only when a person runs `npx prisma db seed` against it. On
2026-09-10 staging served `PRISM_C6-DEMI-BLACK` and empty specs for a day after
both were fixed and deployed, because the code shipped and the data did not.

Running it against a shop that has sold something is safe, and deliberately so —
verified on staging the same day, with an order already placed:

- **Stock is not restored.** Opening quantities are written on create only, so
  the two variants that had sold stayed at 16 and 15.
- **Case stock is not overwritten** once anything has consumed that colour. The
  seed counts `OrderItem`s per colour first; with one black and one white sold,
  it left 149 and 148 alone.
- **Orders are untouched.**

What it *does* refresh is the copy and the specs, which is the point — and the
reason it has to go back to `update: {}` the day the admin CRUD ships.

---

## ⚠️ Going live is not four switches

Asked on 2026-09-14 — *"if we have the company registered, Stripe in live mode
and the photos, can we just go?"* — and the honest answer is that **the selling
machinery is finished and the launch still needs a session of its own.**

What is done is genuinely done: a real purchase on staging, three pairs, correct
SKUs, stock taken once, confirmation email delivered, and the order reaching the
supplier with the case colours intact. None of the list below is code.

**Three of these fail SILENTLY, which is what makes the list worth keeping:**

| | |
|---|---|
| ⚠️ Remove `STAGING_PASSWORD` | Carried over, the real shop asks every customer for a password **and** tells Google not to index it. See the section above — one variable, two switches. |
| ⚠️ Create a **new** Stripe webhook, in LIVE mode | Test-mode endpoints do not receive live events. Without it, the card is charged, the buyer sees the success page, and **no order is created** — exactly the 2026-08-24 failure. `webhook_events` stays empty, which means *nothing arrived*, not *something failed*. |
| ⚠️ Set `NEXT_PUBLIC_APP_URL` **and rebuild** | It is inlined at build time. Changing the variable and restarting serves the old value — the bug that once sent a paying customer to `localhost:3000`. |
| Re-point the three cron jobs | They call `staging.allternativ.com`. Left alone, the production shop never sends a single email. |
| Upstash on production | Or nobody can sign in to the admin: the login limiter fails closed on purpose. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | The defaults are committed and therefore in git history. |
| Fill in `legal.ts` | Legal name, registered address, company number, VAT, IOSS. The "not final" notice on the five legal pages disappears on its own once they are set. |
| Set up `allternativ.com` as a Node app | Only `staging.` is one today; the apex is `website_type: "other"`. That is a deploy step, not a code change. |
| Apply migrations, then push | See the ordering rule above. |

> What is still unexercised in the selling path, and what is outside our hands,
> stays in `CLAUDE.md`: it is state, not procedure.

---

## Fixing vulnerabilities

**Never `npm audit fix`**, with or without `--force`. It rewrites the lockfile
broadly and produces a diff nobody can review. Fix with a targeted version bump,
or with an entry in the `overrides` block in `package.json` — the mechanism is
already there.

Pin ranges deliberately. `next` is on `~16.3.4`, not `^16.3.4`: a caret would let
a fresh install on Hostinger pull a minor nobody tested, and Hostinger reinstalls
on every deploy.

⚠️ **The tilde stops a minor arriving by accident, not on purpose.** On
2026-09-10 the pin was moved from `~16.2.12` to `~16.3.4` deliberately, because
`16.2.12` was the last of its line and a **critical** advisory had no fix inside
it. Crossing a minor is allowed; crossing one without running the suite, the
type check and a production build first is not. That is the whole difference the
tilde is there to enforce.

Move together, always: `@prisma/client`, `@prisma/adapter-mariadb` and the
`prisma` CLI. A mismatch between client, engine and adapter fails confusingly.
