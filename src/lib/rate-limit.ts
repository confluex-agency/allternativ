import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, hasRedis } from "@/lib/env";

const redis = hasRedis
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * What a limiter does when there is no Redis behind it.
 *
 * ⚠️ NOT ALL LIMITERS GUARD THE SAME THING, and treating them alike was making
 * the shop unnecessarily fragile.
 *
 * `critical: true` is for the ones that are a SECURITY control: without them,
 * an unlimited number of password guesses is a real attack. Those refuse to run
 * in production at all, loudly, because silently disabling brute-force
 * protection is worse than an error somebody has to fix.
 *
 * `critical: false` is for the ones that are a COST control: they exist so a
 * busy afternoon cannot run up a bill or exhaust a free tier. Taking the
 * storefront down to protect a quota is the wrong trade — nobody thanks you for
 * a shop that will not load because analytics could not be counted. Those warn
 * once and let the request through.
 */
function noopLimiter(label: string, critical: boolean) {
  let warned = false;
  return {
    limit: async () => {
      if (critical && env.NODE_ENV === "production") {
        throw new Error(
          `[rate-limit] ${label} cannot run in production without UPSTASH_REDIS_REST_URL/TOKEN`,
        );
      }
      if (!warned) {
        console.warn(
          `[rate-limit] ${label} disabled (no Upstash Redis configured)` +
            (critical ? " — DEV ONLY" : " — failing open, this is a cost guard"),
        );
        warned = true;
      }
      return { success: true, limit: 0, remaining: 0, reset: 0 };
    },
  };
}

export const loginLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: true,
      prefix: "rl:login",
    })
  : // Security: an unlimited number of password guesses is an attack.
    noopLimiter("loginLimiter", true);

export const trackingLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "rl:tracking",
    })
  : // Cost: this guards the Upstash free tier, not the shop. A staging
    // preview with no Redis must still serve pages.
    noopLimiter("trackingLimiter", false);

/**
 * Discount code attempts, per visitor.
 *
 * The cart's code field is, unavoidably, an oracle: type a string, learn
 * whether it is a live promotion. That is the price of validating before the
 * money moves, and it is worth paying, but not at unlimited speed. Ten tries in
 * ten minutes is far more than a real customer needs to retype a code off a
 * newsletter, and far too few to walk a dictionary through it.
 *
 * Only attempts that CARRY a code are counted. A checkout without one never
 * touches this, so nothing here can stop somebody from buying.
 */
export const promoCodeLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      prefix: "rl:promo",
    })
  : // Cost-shaped, and the checkout already fails open around it by design.
    noopLimiter("promoCodeLimiter", false);

/**
 * The contact form, per visitor: three messages in ten minutes.
 *
 * ⚠️ Critical, unlike the other cost guards, and the reason is what it shares a
 * quota with. Every message is an email through Resend, and so is every order
 * confirmation. A bot hammering an unthrottled form would not just fill the
 * support inbox, it would spend the daily sending allowance and leave buyers
 * who just paid without their confirmation.
 */
export const contactLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "10 m"),
      prefix: "rl:contact",
    })
  : noopLimiter("contactLimiter", true);

/**
 * The contact form, for everybody together: fifty messages a day.
 *
 * The per-visitor limit does nothing against a bot that rotates addresses, and
 * this is the ceiling that still holds then. Fifty is far above what a shop
 * this size receives, and far below the provider's daily allowance. A real
 * customer who arrives after it is spent is shown the address to write to.
 */
export const contactDailyLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(50, "1 d"),
      prefix: "rl:contact-day",
    })
  : noopLimiter("contactDailyLimiter", true);

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
