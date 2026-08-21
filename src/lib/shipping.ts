// What the customer pays to have a parcel delivered.
//
// Two decisions from the client, both written down in their answers of
// 2026-08-20, drive everything here:
//
//   1. "queremos que el cliente vea el shipping cost separately at checkout,
//      calculado según destination. No queremos incorporar artificialmente el
//      shipping dentro del retail price."
//   2. "FREE SHIPPING ON 2+ PAIRS", capped at four pairs on 2026-08-21
//
// And one confirmed afterwards: the price shown is the supplier's cost, with no
// markup on top. The margin lives in the eyewear, which costs about USD 5.70 to
// put in the box and sells for EUR 39.
//
// ── Only one column is ever CHARGED. All three are needed to COST ───────────
// The supplier quotes three prices per country, for one, two and three pairs in
// the same parcel. Free shipping between two and four pairs means the second
// and third columns are never charged to anybody: a checkout can only ever see
// the one-pair rate, or, past the free window, an extrapolation.
//
// They are still real money going out. A two-pair parcel to Malta costs 18.63
// and not the 14.64 of a single pair, and costing it at the one-pair rate would
// understate what the free-shipping rule is really spending — which is the one
// number it exists to justify. `quoteShipping` charges; `supplierCostUsd` costs.
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
 * The supplier's cost in USD, as `[one pair, two pairs, three pairs]`.
 *
 * Straight from `Quot-260717.xlsx` (Shenzhen Hongyu, 2026-07-16), transcribed
 * from the spreadsheet rather than typed by hand. Kept as the quoted dollars
 * rather than as converted euros on purpose: this table can be checked line by
 * line against the document the supplier sent, with no arithmetic of ours in
 * between.
 *
 * Carrier is YunExpress for every country below.
 */
export const SUPPLIER_SHIPPING_USD: Record<string, [number, number, number]> = {
  // ── European Union ──
  AT: [11.31, 13.1, 14.88], // Austria
  BE: [11.72, 13.92, 16.11], // Belgium
  BG: [11.23, 13.74, 16.25], // Bulgaria
  CY: [14.05, 17.6, 21.14], // Cyprus
  CZ: [10.93, 12.81, 14.68], // Czechia
  DE: [11.03, 12.69, 14.35], // Germany
  DK: [12.66, 15.63, 18.6], // Denmark
  EE: [11.39, 13.72, 16.06], // Estonia
  ES: [10.41, 12.1, 13.78], // Spain
  FI: [12.09, 14.16, 16.23], // Finland
  FR: [10.73, 12.42, 14.1], // France
  GR: [11.06, 13.4, 15.74], // Greece
  HR: [13.15, 16.29, 19.43], // Croatia
  HU: [11.31, 13.4, 15.5], // Hungary
  IE: [12.09, 14.64, 17.2], // Ireland
  IT: [11.59, 13.32, 15.06], // Italy
  LT: [10.93, 12.81, 14.68], // Lithuania
  LU: [13.29, 16.4, 19.52], // Luxembourg
  LV: [11.0, 12.95, 14.9], // Latvia
  MT: [14.64, 18.63, 22.61], // Malta
  NL: [12.21, 14.89, 17.56], // Netherlands
  PL: [10.68, 13.11, 15.55], // Poland
  PT: [11.51, 13.97, 16.43], // Portugal
  RO: [11.72, 14.4, 17.08], // Romania
  SE: [11.52, 13.84, 16.15], // Sweden
  SI: [13.03, 16.05, 19.06], // Slovenia
  SK: [11.89, 14.74, 17.59], // Slovakia
  // ── United Kingdom ──
  GB: [6.15, 7.76, 9.37],
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

/**
 * Convert US cents into another currency's minor units, at the frozen rate.
 *
 * Lives here because `FX` does, and `FX` lives here because delivery was the
 * first thing that had to cross currencies. The supplier bills everything in
 * dollars, so the product cost needs the same conversion.
 *
 * Returns null for an unknown amount or currency rather than zero: in a margin
 * report a null reads as "we do not know", and a zero reads as "it was free".
 */
export function usdCentsTo(
  usdCents: number | null | undefined,
  currency: string,
): number | null {
  if (usdCents === null || usdCents === undefined) return null;
  const rate = FX.perUsd[currency.toUpperCase()];
  if (rate === undefined) return null;
  return Math.round(usdCents * rate);
}

/** Two or more pairs ship free. The client's rule, and their AOV lever. */
export const FREE_SHIPPING_FROM_PAIRS = 2;

/**
 * ...but only up to four. Manuel and Belu closed this on 2026-08-21: "hasta 4
 * lentes seria el descuento de envio gratis".
 *
 * Their original text said "FREE SHIPPING ON 2+ PAIRS", with no ceiling, which
 * would have given away delivery on an order of any size. This is the ceiling.
 *
 * ⚠️ It creates a step at the fifth pair, and the step is not small: a fifth
 * pair costs the customer its own price plus the whole parcel's delivery, so
 * the cart is at its most expensive exactly where the order is at its most
 * profitable. The numbers, and the alternative reading of their sentence, are
 * in the vault under "Preguntas a Manuel y Belu". Implemented as written.
 */
export const FREE_SHIPPING_MAX_PAIRS = 4;

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
  const tiers = SUPPLIER_SHIPPING_USD[country];
  if (tiers === undefined) return null;

  const rate = FX.perUsd[currency.toUpperCase()];
  if (rate === undefined) return null;

  const free =
    pairs >= FREE_SHIPPING_FROM_PAIRS && pairs <= FREE_SHIPPING_MAX_PAIRS;

  // A single pair is charged from the quotation's first column. Above the free
  // window there is no column left to read - the supplier only quoted one, two
  // and three - so the same extrapolation the cost side uses is charged, at
  // cost and with no markup, like every other delivery here.
  const usdCents =
    pairs <= 1 ? tiers[0] * 100 : supplierCostUsdCents(country, pairs);

  return {
    country,
    amountCents: free ? 0 : Math.round(usdCents * rate),
    currency,
    free,
    pairsToFree: Math.max(0, FREE_SHIPPING_FROM_PAIRS - pairs),
  };
}

/**
 * What the parcel actually costs Allternativ, in US cents. The other half of
 * the sum: `quoteShipping` is what comes in, this is what goes out.
 *
 * ⚠️ Above three pairs the quotation runs out. Rather than repeat the
 * three-pair figure, which would understate every large order, the cost is
 * extended by the marginal step between the last two tiers — the supplier's
 * own increments are flat (Germany: +1.66, +1.66), so this is a reasonable
 * estimate and not a guess pulled from nowhere. It stays an ESTIMATE until
 * Daniel answers question 6 of the supplier document, which asks exactly this.
 */
export function supplierCostUsdCents(country: string, pairs: number): number {
  const tiers = SUPPLIER_SHIPPING_USD[country];
  if (tiers === undefined || pairs <= 0) return 0;
  if (pairs <= 3) return Math.round(tiers[pairs - 1] * 100);
  const marginalStep = tiers[2] - tiers[1];
  return Math.round((tiers[2] + (pairs - 3) * marginalStep) * 100);
}

/**
 * The nudge next to the cart total. The client wrote this copy themselves, so
 * it is reproduced word for word rather than paraphrased.
 */
export function freeShippingMessage(pairs: number): string | null {
  if (pairs <= 0) return null;
  if (pairs > FREE_SHIPPING_MAX_PAIRS) return null;
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
