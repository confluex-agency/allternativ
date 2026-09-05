const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`[env] Missing required variable: ${key}`);
  }
}

if (process.env.JWT_SECRET!.length < 32) {
  throw new Error("[env] JWT_SECRET must be at least 32 characters");
}

// ── NEXT_PUBLIC_APP_URL has to be somewhere a paying customer can arrive ──
//
// ⚠️ This variable is not like the others, and the difference cost a real
// payment on 2026-08-24.
//
// It is what `success_url` and `cancel_url` are built from, so it is the
// address Stripe sends the shopper back to AFTER their card has been charged.
// Staging was deployed with the development value still in place, and the
// result was exactly what you would expect and nobody predicted: the money was
// taken, and the browser was then sent to `http://localhost:3000`, which on a
// customer's machine is a blank error page. Nothing threw. Nothing logged. The
// only trace was in Stripe.
//
// Two properties make it uniquely dangerous, and they compound:
//
//   1. `NEXT_PUBLIC_` variables are INLINED AT BUILD TIME. Correcting it in the
//      host's panel and restarting the app does nothing at all — the wrong
//      value is already compiled into the bundle. It needs a rebuild. Somebody
//      who does not know that will fix it, see no change, and go looking for
//      the bug somewhere else entirely.
//   2. It is only ever exercised at the very end of a checkout, after the money
//      has moved. Every test that stops short of paying passes.
//
// So it is checked here, at load, where being wrong is a build that fails
// loudly rather than a shop that takes money and shows a blank page. A
// deployment that cannot complete is a bad afternoon; a deployment that
// silently loses customers after charging them is worse.
{
  const raw = process.env.NEXT_PUBLIC_APP_URL!;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `[env] NEXT_PUBLIC_APP_URL is not a valid URL: ${raw}. ` +
        `It needs the scheme too, e.g. https://staging.allternativ.com`,
    );
  }

  // Loopback is correct in development and catastrophic anywhere else, so the
  // test is the environment, not the hostname on its own.
  const LOOPBACK = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"];
  const isLoopback = LOOPBACK.includes(url.hostname);

  if (process.env.NODE_ENV === "production") {
    if (isLoopback) {
      throw new Error(
        `[env] NEXT_PUBLIC_APP_URL points at ${url.hostname}, which no customer ` +
          `can reach. It is where Stripe returns the shopper AFTER charging ` +
          `their card, so this would take the money and land them on a blank ` +
          `page. Set it to the deployment's public address. Note that it is ` +
          `inlined at build time: the app must be REBUILT, not just restarted.`,
      );
    }
    if (url.protocol !== "https:") {
      throw new Error(
        `[env] NEXT_PUBLIC_APP_URL must be https in production (got ` +
          `${url.protocol}//). It is a post-payment redirect target.`,
      );
    }
  }
}

// Upstash check runs at request time (in rate-limit.ts), not at module load,
// so `next build` doesn't fail when build-time env doesn't have Redis vars.

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY!,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET!,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
};

export const hasRedis = Boolean(
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN,
);
