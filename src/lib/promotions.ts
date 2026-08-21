// Discount codes, checked before the customer is sent to pay.
//
// ── Why the code is typed HERE and not on Stripe's page ─────────────────────
// It used to be `allow_promotion_codes: true`, which puts the field on Stripe's
// hosted page. Convenient, and impossible to guard: by the time Stripe applies
// the coupon the session already exists, the price is already agreed, and the
// only thing left to do is watch the money leave. Anything we want to REFUSE
// has to be known before the session is created, so the field moves into our
// cart and the session is created with the discount already attached.
//
// It is the same move the delivery country made, and for the same underlying
// reason: Stripe's hosted page cannot be renegotiated once it is open, so every
// decision that depends on the basket has to happen on our side of the redirect.
//
// ── What it does NOT do ─────────────────────────────────────────────────────
// It does not replace Stripe as the source of truth. The coupon still lives in
// the dashboard, the team still creates it without a deploy, and Stripe still
// enforces expiry, redemption limits and first-time-customer rules at payment.
// This only asks one extra question Stripe has no way to answer: does this code
// on THIS basket still leave money on the table.

import { stripe } from "@/lib/stripe";
import { quoteShipping, supplierCostUsdCents, usdCentsTo } from "@/lib/shipping";
import {
  estimatePaymentFeeCents,
  goodsCostCentsFor,
  netCents,
  MINIMUM_NET_CENTS,
} from "@/lib/margin";

export type PromotionRejection = {
  ok: false;
  /** Shown to the customer. Never names the margin: it is nobody's business. */
  message: string;
  /** For the log. Says what really happened. */
  detail: string;
};

export type PromotionAcceptance = {
  ok: true;
  promotionCodeId: string;
  code: string;
  discountCents: number;
};

export type PromotionResult = PromotionAcceptance | PromotionRejection;

const NOT_VALID: Omit<PromotionRejection, "detail"> = {
  ok: false,
  // One message for every way a code can fail to exist or apply. Distinct
  // messages would let anyone map out which codes are real by reading the
  // differences, which is how coupon lists get scraped.
  message: "That code is not valid for this order.",
};

/**
 * Look up a code and work out what it would take off THIS basket.
 *
 * `subtotalCents` is the eyewear only. Stripe does not discount delivery, and
 * neither does this.
 */
export async function evaluatePromotionCode(
  code: string,
  subtotalCents: number,
  currency: string,
): Promise<PromotionResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ...NOT_VALID, detail: "empty code" };

  // The coupon has to be expanded: on this API version the promotion code only
  // carries its id, and the id alone says nothing about how much comes off.
  const found = await stripe.promotionCodes.list({
    code: trimmed,
    active: true,
    limit: 1,
    expand: ["data.promotion.coupon"],
  });
  const promotion = found.data[0];
  if (!promotion) return { ...NOT_VALID, detail: `no active code "${trimmed}"` };

  const coupon = promotion.promotion?.coupon;
  if (!coupon || typeof coupon === "string") {
    // Expanded above, so a bare id here means Stripe returned something we do
    // not understand. Refuse rather than guess a discount of zero and let it
    // through: guessing zero would approve a code we cannot actually price.
    return {
      ...NOT_VALID,
      detail: `coupon for ${promotion.id} did not expand`,
    };
  }
  if (!coupon.valid) {
    return { ...NOT_VALID, detail: `coupon ${coupon.id} is no longer valid` };
  }

  // A coupon restricted to particular Stripe Products cannot work here, and
  // failing loudly beats failing silently. Our line items are built with
  // `price_data` on the fly and have no Product behind them, so such a coupon
  // would match nothing, take nothing off, and leave the customer staring at an
  // unchanged total with no explanation.
  if (coupon.applies_to?.products?.length) {
    return {
      ...NOT_VALID,
      detail:
        `coupon ${coupon.id} is restricted to specific Stripe products, ` +
        `which this store's ad-hoc line items can never match`,
    };
  }

  // A minimum can be set globally or per currency, and the per-currency one
  // wins when the basket's currency has an entry.
  const restrictions = promotion.restrictions;
  const perCurrencyMinimum =
    restrictions?.currency_options?.[currency.toLowerCase()]?.minimum_amount;
  const globalMinimum =
    restrictions?.minimum_amount_currency?.toLowerCase() ===
    currency.toLowerCase()
      ? restrictions.minimum_amount
      : null;
  const minimum = perCurrencyMinimum ?? globalMinimum;

  if (minimum && subtotalCents < minimum) {
    return {
      ok: false,
      // The one case worth explaining, because the customer can act on it.
      message: "This order is below the minimum for that code.",
      detail: `subtotal ${subtotalCents} under minimum ${minimum}`,
    };
  }

  let discountCents: number;
  if (coupon.percent_off) {
    discountCents = Math.round((subtotalCents * coupon.percent_off) / 100);
  } else if (coupon.amount_off) {
    if (coupon.currency?.toLowerCase() !== currency.toLowerCase()) {
      return {
        ...NOT_VALID,
        detail: `coupon ${coupon.id} is in ${coupon.currency}, basket in ${currency}`,
      };
    }
    // Stripe never takes a total below zero, and neither does the estimate.
    discountCents = Math.min(coupon.amount_off, subtotalCents);
  } else {
    return { ...NOT_VALID, detail: `coupon ${coupon.id} discounts nothing` };
  }

  return {
    ok: true,
    promotionCodeId: promotion.id,
    code: promotion.code,
    discountCents,
  };
}

/** One line of the basket, priced and costed. Both callers build this. */
export type BasketLine = {
  priceCents: number;
  supplierCostUsdCents: number | null;
  quantity: number;
};

/**
 * The whole decision: is this code real, and does it leave money on the table
 * for THIS basket.
 *
 * ⚠️ Deliberately the only place that answers either question. Two callers need
 * it: the cart's Apply button, which shows the customer what comes off, and the
 * checkout, which creates the session. If they were separate implementations
 * they would eventually disagree, and the way that failure looks from outside
 * is a discount that appears in the cart and vanishes at the payment page,
 * which reads as the shop having lied.
 *
 * The preview is advisory; the checkout is authoritative. Both run this, so
 * they agree, but the checkout never trusts a number the browser sends.
 */
export async function evaluateDiscountForBasket(opts: {
  code: string;
  lines: BasketLine[];
  currency: string;
  destinationCountry: string;
}): Promise<PromotionResult> {
  const { code, lines, currency, destinationCountry } = opts;

  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.priceCents * line.quantity,
    0,
  );
  const pairs = lines.reduce((n, line) => n + line.quantity, 0);

  const evaluated = await evaluatePromotionCode(code, subtotalCents, currency);
  if (!evaluated.ok) return evaluated;

  const shipping = quoteShipping(destinationCountry, pairs, currency);
  if (!shipping) {
    return {
      ok: false,
      message: "We do not ship to that country yet.",
      detail: `no quoted rate for ${destinationCountry}`,
    };
  }

  const revenueCents =
    subtotalCents - evaluated.discountCents + shipping.amountCents;
  const economics = {
    revenueCents,
    goodsCostCents: goodsCostCentsFor(lines, currency),
    // What the parcel COSTS, not what was charged for it. Between two and four
    // pairs those two numbers are as far apart as they get: the customer pays
    // nothing and the whole thing comes out of the margin.
    shippingCostCents:
      usdCentsTo(supplierCostUsdCents(destinationCountry, pairs), currency) ?? 0,
    paymentFeeCents: estimatePaymentFeeCents(revenueCents, currency),
  };
  const net = netCents(economics);

  if (net < MINIMUM_NET_CENTS) {
    // Loud, and naming the code. A code that can sink an order is a mistake in
    // the Stripe dashboard that somebody has to go and fix, not a customer
    // error, and nobody will find it unless it is said here.
    console.error(
      `[margin] REFUSED. Code "${evaluated.code}" on ${pairs} pair(s) to ` +
        `${destinationCountry} would net ${net} ${currency.toUpperCase()}: ` +
        `revenue ${economics.revenueCents}, goods ${economics.goodsCostCents}, ` +
        `shipping ${economics.shippingCostCents}, fee ~${economics.paymentFeeCents}` +
        (shipping.free ? ". Delivery absorbed." : ""),
    );
    return {
      ...NOT_VALID,
      detail: `net ${net} below floor ${MINIMUM_NET_CENTS}`,
    };
  }

  return evaluated;
}
