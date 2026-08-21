// What is left after a sale, and the line under which a sale must not go.
//
// Lives on its own because two places need the same arithmetic and they must
// never drift: the checkout, which refuses an order before the money moves, and
// the webhook, which records what actually happened and shouts if it went
// wrong. The same sum written twice is the same sum until somebody edits one.
//
// ── Why a floor was needed at all ───────────────────────────────────────────
// Discount codes are created in the Stripe dashboard, outside this codebase and
// without any minimum. Delivery is absorbed from two pairs up. So a deep enough
// code sells below cost, and what makes it invisible is that the discount cuts
// what comes IN while the pair and the parcel still cost exactly the same going
// OUT. The Corinthian, two pairs to Malta, breaks even at roughly 66% off.

import { usdCentsTo } from "@/lib/shipping";

/**
 * Stripe's cut, estimated.
 *
 * ⚠️ AN ESTIMATE, AND DELIBERATELY THE OPTIMISTIC ONE. This is the European
 * card rate; a card issued outside the EEA costs noticeably more, and we cannot
 * know which one the customer will use until they use it.
 *
 * Optimistic on purpose. The floor should refuse the orders that lose money on
 * ANY card, not the ones that might lose money on an expensive one: refusing a
 * legitimate campaign code is a real cost too. The marginal cases are caught
 * afterwards by the webhook, which reads the true fee from Stripe's balance
 * transaction and says so. Two nets, one before and one after, on purpose.
 *
 * TODO confirm against the live Stripe account once it exists: the rate depends
 * on the country the business is registered in, and Allternativ is not
 * registered yet.
 */
export const STRIPE_FEE = {
  percent: 1.5,
  /** The fixed part, in each currency's minor units. */
  fixedCents: {
    eur: 25,
    gbp: 20,
    usd: 30,
    aud: 30,
    ars: 0,
    clp: 0,
  } as Record<string, number>,
};

export function estimatePaymentFeeCents(
  chargedCents: number,
  currency: string,
): number {
  if (chargedCents <= 0) return 0;
  const fixed = STRIPE_FEE.fixedCents[currency.toLowerCase()] ?? 25;
  return Math.round((chargedCents * STRIPE_FEE.percent) / 100) + fixed;
}

export type OrderEconomics = {
  /** Everything the customer pays, delivery included, after any discount. */
  revenueCents: number;
  /** The pairs, at what they cost us, packaging included. */
  goodsCostCents: number;
  /** What the parcel costs the supplier to send, whatever we charged for it. */
  shippingCostCents: number;
  /** Stripe's cut. Estimated before the sale, actual after it. */
  paymentFeeCents: number;
};

/** Revenue minus everything that leaves. Negative means the sale lost money. */
export function netCents(e: OrderEconomics): number {
  return (
    e.revenueCents - e.goodsCostCents - e.shippingCostCents - e.paymentFeeCents
  );
}

/**
 * The line. An order whose net falls below this is refused at the checkout.
 *
 * Zero, which is break-even: today the shop only refuses sales that certainly
 * lose money, and no judgement is made about a sale that merely earns little.
 *
 * ⚠️ There is a case for raising it, and it is a commercial decision rather
 * than a technical one, so it is not being made here. The 300 pairs are bought
 * and finite: a pair sold at break-even is not a neutral event, it is a unit of
 * a limited stock that can no longer be sold at €39. Question for Manuel and
 * Belu. Raising it is this one number.
 */
export const MINIMUM_NET_CENTS = 0;

/** The pairs, at cost, in the currency being charged. */
export function goodsCostCentsFor(
  lines: { supplierCostUsdCents: number | null; quantity: number }[],
  currency: string,
): number {
  return lines.reduce(
    (sum, line) =>
      sum + (usdCentsTo(line.supplierCostUsdCents, currency) ?? 0) * line.quantity,
    0,
  );
}
