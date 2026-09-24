// The promotions screen: codes created, listed and switched off from the admin.
//
// ⚠️ The codes still LIVE IN STRIPE, and this is the decision CLAUDE.md records
// ("The promotions screen is the one circuit still half-built"): a second brief
// asked for our own table of discounts, and that part was declined. Stripe
// already does expiry, redemption limits and first-order-only for free, and
// owning the table would mean computing the charged amount ourselves and
// counting redemptions against a race shaped like overselling. What was
// missing was a screen, so this is a screen over Stripe's API.
//
// What it adds that Stripe's dashboard cannot: before a code exists, it says
// which baskets it would sell below cost. The checkout already refuses those
// baskets one at a time (`evaluateDiscountForBasket`); this is the same
// arithmetic asked in advance, so a founder does not publish a code on
// Instagram that half the countries will be told is "not valid".
//
// Only PERCENTAGE codes are created here. A fixed amount is a figure in one
// currency and the shop sells in six; Stripe accepts it and the checkout
// refuses it in every other market. Existing fixed-amount codes are listed and
// can be switched off like any other.

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { recordAudit } from "@/lib/audit";
import type { JWTPayload } from "@/lib/auth";
import { MARKETS, type MarketKey } from "@/lib/markets";
import { basketsAt, type WorstCase } from "@/lib/prices-admin";
import { MINIMUM_NET_CENTS } from "@/lib/margin";

export type PromotionRow = {
  id: string;
  code: string;
  active: boolean;
  /** "20% off", "€5.00 off". */
  offer: string;
  percentOff: number | null;
  timesRedeemed: number;
  maxRedemptions: number | null;
  expiresAt: Date | null;
  firstOrderOnly: boolean;
  createdAt: Date;
};

export async function listPromotions(): Promise<PromotionRow[]> {
  const page = await stripe.promotionCodes.list({
    limit: 100,
    expand: ["data.promotion.coupon"],
  });
  return page.data.map((p) => {
    const coupon =
      typeof p.promotion?.coupon === "object" ? p.promotion.coupon : null;
    const percent = coupon?.percent_off ?? null;
    const offer = percent
      ? `${percent}% off`
      : coupon?.amount_off && coupon.currency
        ? `${(coupon.amount_off / 100).toFixed(2)} ${coupon.currency.toUpperCase()} off`
        : "unknown";
    return {
      id: p.id,
      code: p.code,
      active: p.active,
      offer,
      percentOff: percent,
      timesRedeemed: p.times_redeemed,
      maxRedemptions: p.max_redemptions ?? null,
      expiresAt: p.expires_at ? new Date(p.expires_at * 1000) : null,
      firstOrderOnly: p.restrictions?.first_time_transaction ?? false,
      createdAt: new Date(p.created * 1000),
    };
  });
}

export type MarketImpact = {
  market: MarketKey;
  /** How many kinds of basket (country × pairs) the code would be refused on. */
  refused: number;
  total: number;
  worst: WorstCase | null;
};

/**
 * Which baskets a percentage code would be refused on, per market.
 *
 * Priced against the DEAREST model in the line and each market's current
 * price: a code is public, so it has to hold for the worst basket somebody can
 * put together, not the average one.
 */
export async function discountImpact(percentOff: number): Promise<MarketImpact[]> {
  const products = await prisma.product.findMany({
    where: { status: "LIVE" },
    select: {
      supplierCostUsdCents: true,
      marketPrices: { select: { market: true, priceCents: true } },
    },
  });

  return (Object.keys(MARKETS) as MarketKey[]).map((market) => {
    let refused = 0;
    let total = 0;
    let worst: WorstCase | null = null;
    for (const p of products) {
      const price = p.marketPrices.find((m) => m.market === market)?.priceCents;
      if (price === undefined) continue;
      for (const b of basketsAt(p.supplierCostUsdCents, market, price, percentOff) ?? []) {
        total++;
        if (b.netCents < MINIMUM_NET_CENTS) refused++;
        if (!worst || b.netCents < worst.netCents) worst = b;
      }
    }
    return { market, refused, total, worst };
  });
}

/** What a customer types. Stripe allows more; a code read aloud should not. */
export const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

export type CreateResult =
  | { ok: true; id: string; code: string }
  | { ok: false; message: string };

export async function createPromotion(input: {
  code: string;
  percentOff: number;
  maxRedemptions: number | null;
  expiresAt: Date | null;
  firstOrderOnly: boolean;
  actor: JWTPayload;
}): Promise<CreateResult> {
  const code = input.code.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    return {
      ok: false,
      message: "Use 3 to 32 letters, numbers or dashes, e.g. LAUNCH20.",
    };
  }

  // Stripe refuses a duplicate active code with its own error, but saying it
  // in our words is kinder than relaying theirs.
  const existing = await stripe.promotionCodes.list({ code, limit: 1 });
  if (existing.data.length > 0) {
    return { ok: false, message: `There is already a code called ${code}.` };
  }

  // One coupon per code. Sharing a coupon across codes saves nothing and
  // makes "switch this one off" ambiguous.
  const coupon = await stripe.coupons.create({
    percent_off: input.percentOff,
    duration: "once",
    name: code,
  });

  try {
    const promotion = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
      ...(input.expiresAt
        ? { expires_at: Math.floor(input.expiresAt.getTime() / 1000) }
        : {}),
      ...(input.firstOrderOnly
        ? { restrictions: { first_time_transaction: true } }
        : {}),
    });

    await recordAudit({
      actor: input.actor,
      action: "create",
      entityType: "promotion",
      entityId: promotion.id,
      entityLabel: code,
      newValue: {
        percentOff: input.percentOff,
        maxRedemptions: input.maxRedemptions,
        expiresAt: input.expiresAt?.toISOString() ?? null,
        firstOrderOnly: input.firstOrderOnly,
      },
    });
    return { ok: true, id: promotion.id, code };
  } catch (error) {
    // Leave no orphan coupon behind a code that was never made.
    await stripe.coupons.del(coupon.id).catch(() => undefined);
    return {
      ok: false,
      message:
        error instanceof Error ? `Stripe refused it: ${error.message}` : "Stripe refused it.",
    };
  }
}

export async function setPromotionActive(input: {
  id: string;
  active: boolean;
  actor: JWTPayload;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const updated = await stripe.promotionCodes.update(input.id, {
      active: input.active,
    });
    await recordAudit({
      actor: input.actor,
      action: "update",
      entityType: "promotion",
      entityId: updated.id,
      entityLabel: updated.code,
      oldValue: { active: !input.active },
      newValue: { active: input.active },
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? `Stripe refused it: ${error.message}` : "Stripe refused it.",
    };
  }
}
