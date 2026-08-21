import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, hasRedis } from "@/lib/env";

const redis = hasRedis
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

function noopLimiter(label: string) {
  let warned = false;
  return {
    limit: async () => {
      if (env.NODE_ENV === "production") {
        throw new Error(
          `[rate-limit] ${label} cannot run in production without UPSTASH_REDIS_REST_URL/TOKEN`,
        );
      }
      if (!warned) {
        console.warn(
          `[rate-limit] ${label} disabled (no Upstash Redis configured) — DEV ONLY`,
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
  : noopLimiter("loginLimiter");

export const trackingLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "rl:tracking",
    })
  : noopLimiter("trackingLimiter");

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
  : noopLimiter("promoCodeLimiter");

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
