// What the customer pays to have a parcel delivered.
//
// Two decisions from the client, both written down in their answers of
// 2026-08-20, drive everything here:
//
//   1. "queremos que el cliente vea el shipping cost separately at checkout,
//      calculado según destination. No queremos incorporar artificialmente el
//      shipping dentro del retail price."
//   2. "FREE SHIPPING ON 2+ PAIRS"
//
// And one confirmed afterwards: the price shown is the supplier's cost, with no
// markup on top. The margin lives in the eyewear, which costs about USD 5.70 to
// put in the box and sells for EUR 39.
//
// ── Why there is only one column of figures ─────────────────────────────────
// The supplier quotes three prices per country, for one, two and three pairs in
// the same parcel. Free shipping from two pairs means the second and third
// columns are never charged to anybody: they are a cost Allternativ absorbs to
// lift the basket. So the only figure that can ever reach a checkout is the
// one-pair rate, and that is all this file holds.
//
// ── Why the exchange rate is frozen ─────────────────────────────────────────
// The supplier quotes in dollars and the shop charges in euros, so somebody has
// to carry the currency risk. It is deliberately carried, not passed on:
//
//   * The client already made this exact choice for the much larger number.
//     The eyewear is bought in dollars and sold at a fixed EUR 39 "para
//     controlar exactamente cómo se posiciona el producto en cada mercado".
//     A floating shipping price beside a fixed product price is incoherent.
//   * The exposure is small. A 10% move in the dollar is worth under one euro
//     on a single-pair order, against roughly EUR 33 of product margin.
//   * A live rate would make the price move between the cart and the payment
//     page, so someone who hesitates comes back to a different number, and an
//     outage at the rate provider would take the checkout down with it.
//
// Re-freezing is a one-line change. `npm run fx:check` reports the drift.

import { STORE_CURRENCY } from "@/lib/utils";

/**
 * The supplier's cost to deliver ONE pair, in USD.
 *
 * Straight from `Quot-260717.xlsx` (Shenzhen Hongyu, 2026-07-16), first price
 * column. Kept as the quoted dollars rather than as converted euros on purpose:
 * this table can be checked line by line against the document the supplier
 * sent, and no arithmetic of ours sits between the two.
 *
 * Carrier is YunExpress for every country below.
 */
export const SUPPLIER_SHIPPING_USD: Record<string, number> = {
  // ── European Union ──
  AT: 11.31,
  BE: 11.72,
  BG: 11.23,
  CY: 14.05,
  CZ: 10.93,
  DE: 11.03,
  DK: 12.66,
  EE: 11.39,
  ES: 10.41,
  FI: 12.09,
  FR: 10.73,
  GR: 11.06,
  HR: 13.15,
  HU: 11.31,
  IE: 12.09,
  IT: 11.59,
  LT: 10.93,
  LU: 13.29,
  LV: 11.0,
  MT: 14.64,
  NL: 12.21,
  PL: 10.68,
  PT: 11.51,
  RO: 11.72,
  SE: 11.52,
  SI: 13.03,
  SK: 11.89,
  // ── United Kingdom ──
  GB: 6.15,
};

/**
 * Frozen exchange rates, base USD. From frankfurter.dev on the date below.
 *
 * ⚠️ Changing these changes what every customer is charged for delivery. Do it
 * deliberately, and move the date with them.
 */
export const FX = {
  date: "2026-08-20",
  source: "frankfurter.dev",
  /** How many units of the currency one US dollar buys. */
  perUsd: {
    EUR: 0.85609,
    GBP: 0.73388,
    USD: 1,
    CAD: 1.377,
    AUD: 1.4072,
    NZD: 1.6828,
  } as Record<string, number>,
};

/** Two or more pairs ship free. The client's rule, and their AOV lever. */
export const FREE_SHIPPING_FROM_PAIRS = 2;

/** Countries the shop will deliver to, derived from the quote above. */
export const SHIPPABLE_COUNTRIES = Object.keys(SUPPLIER_SHIPPING_USD).sort();

export function isShippableCountry(country: string): boolean {
  return country in SUPPLIER_SHIPPING_USD;
}

export type ShippingQuote = {
  country: string;
  /** Minor units, in `currency`. Zero when the order ships free. */
  amountCents: number;
  currency: string;
  free: boolean;
  /** How many more pairs earn free delivery. Zero once it is earned. */
  pairsToFree: number;
};

/**
 * What to charge for delivering `pairs` pairs to `country`.
 *
 * Rounded to the nearest minor unit, not up: the client asked for the
 * supplier's cost with no markup, and rounding up would quietly become one.
 */
export function quoteShipping(
  country: string,
  pairs: number,
  currency: string = STORE_CURRENCY,
): ShippingQuote | null {
  const usd = SUPPLIER_SHIPPING_USD[country];
  if (usd === undefined) return null;

  const rate = FX.perUsd[currency.toUpperCase()];
  if (rate === undefined) return null;

  const free = pairs >= FREE_SHIPPING_FROM_PAIRS;
  return {
    country,
    amountCents: free ? 0 : Math.round(usd * rate * 100),
    currency,
    free,
    pairsToFree: Math.max(0, FREE_SHIPPING_FROM_PAIRS - pairs),
  };
}

/**
 * The nudge next to the cart total. The client wrote this copy themselves, so
 * it is reproduced word for word rather than paraphrased.
 */
export function freeShippingMessage(pairs: number): string | null {
  if (pairs <= 0) return null;
  if (pairs >= FREE_SHIPPING_FROM_PAIRS)
    return "You've unlocked free shipping.";
  const missing = FREE_SHIPPING_FROM_PAIRS - pairs;
  return `You're ${missing} pair${missing === 1 ? "" : "s"} away from free shipping.`;
}

/**
 * Delivery window shown to the customer.
 *
 * The supplier quotes 1 business day of handling plus 7-12 of transit. The
 * client deliberately communicates a wider band than that: "para la
 * comunicación al cliente preferimos utilizar un margen un poco más
 * conservador".
 */
export const DELIVERY_ESTIMATE_BUSINESS_DAYS = { minimum: 8, maximum: 15 };
