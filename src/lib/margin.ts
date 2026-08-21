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
 * TODO confirm every figure here against the live Stripe account once it
 * exists. The rates depend on the country the business is registered in, and
 * Allternativ is not registered yet, so these are the usual European numbers
 * and not quoted ones. The webhook records what Stripe actually charged on
 * every order, so the day the account exists these become checkable rather
 * than assumed.
 */
export const STRIPE_FEE = {
  percent: 1.5,
  /** The fixed part, in each currency's minor units. */
  fixedCents: {
    eur: 25,
    gbp: 20,
    usd: 30,
    cad: 30,
    aud: 30,
    nzd: 30,
  } as Record<string, number>,
  /**
   * What Stripe takes to turn a foreign-currency charge into the currency the
   * bank account is held in.
   *
   * ⚠️ THIS IS WHERE A COMMON ASSUMPTION GOES WRONG. Stripe does not settle
   * everything in dollars, and it does not settle everything in one currency
   * either. It charges the card in whatever currency the session asks for, so a
   * customer in Australia really is billed AUD 64. What happens next is the
   * part that costs money: unless there is a bank account in that same
   * currency, Stripe converts the payout, and takes a cut for doing it.
   *
   * The consequence for this file is direct: a sale in a market whose currency
   * is not the settlement currency carries roughly this much more cost than the
   * headline processing rate, and the discount floor has to know that or it
   * will approve codes on foreign orders that quietly lose money.
   */
  conversionPercent: 2,
};

/**
 * The currencies Stripe pays out WITHOUT converting, because there is an account
 * waiting in each one.
 *
 * The plan, decided 2026-08-21: settle in more than one currency through the
 * Revolut Business account the team already has, so a sale in pounds arrives as
 * pounds instead of being converted into euros on the way. Every currency in
 * this set costs the plain processing rate; every currency outside it also
 * pays `conversionPercent`.
 *
 * ⚠️ THREE, NOT SIX, AND THAT IS NOT AN OVERSIGHT. Which currencies Stripe will
 * actually pay out depends on the country the Stripe account is registered in,
 * and Allternativ is not registered anywhere yet. EUR, GBP and USD are the ones
 * a European account can normally settle. CAD, AUD and NZD are the doubtful
 * ones: having a Revolut account that can HOLD a currency is not the same as
 * Stripe being willing to PAY OUT in it.
 *
 * So this is the honest middle, not a promise. Confirm it against the real
 * Stripe account the day it exists, and move currencies across in either
 * direction — it is one line, and the webhook records what Stripe actually
 * charged on every order, so the guess becomes checkable rather than permanent.
 */
export const SETTLEMENT_CURRENCIES = new Set(["eur", "gbp", "usd"]);

export function estimatePaymentFeeCents(
  chargedCents: number,
  currency: string,
): number {
  if (chargedCents <= 0) return 0;
  const code = currency.toLowerCase();
  const fixed = STRIPE_FEE.fixedCents[code] ?? 25;
  const converts = !SETTLEMENT_CURRENCIES.has(code);
  const percent =
    STRIPE_FEE.percent + (converts ? STRIPE_FEE.conversionPercent : 0);
  return Math.round((chargedCents * percent) / 100) + fixed;
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
