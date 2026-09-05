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
// ── Two columns are ever CHARGED. All five are needed to COST ─────────────
// The supplier quotes five prices per country, for one to five pairs in the
// same parcel. Free shipping between two and four pairs means the middle three
// columns are never charged to anybody: a checkout can only ever see the
// one-pair rate, the five-pair rate, or, past that, an extrapolation.
//
// The three it never charges are still real money going out. A two-pair parcel
// to Malta costs 18.63 and not the 14.64 of a single pair, and costing it at
// the one-pair rate would understate what the free-shipping rule is really
// spending — which is the one number it exists to justify. `quoteShipping`
// charges; `supplierCostUsdCents` costs.
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
 * The supplier's cost in USD, as `[one pair, two, three, four, five]`.
 *
 * Straight from `Quot-260825.xlsx` (Shenzhen Hongyu, 2026-08-25), transcribed
 * from the spreadsheet rather than typed by hand. Kept as the quoted dollars
 * rather than as converted euros on purpose: this table can be checked line by
 * line against the document the supplier sent, with no arithmetic of ours in
 * between.
 *
 * ── What the August quotation changed ──────────────────────────────────────
 * Two things, and only two. Every one of the thirty-two rates we sell against
 * was re-quoted at the identical figure except Australia's two-pair rate, and
 * the columns now run to five pairs instead of three.
 *
 * That second half is what matters here. The old table stopped at three, so
 * four pairs and up were EXTRAPOLATED from the marginal step, and four pairs is
 * inside the free-shipping window — meaning the number Allternativ absorbs on
 * its own AOV lever was an estimate. It is now the supplier's own figure.
 *
 * ⚠️ Two caveats Daniel attached on 2026-08-25, both of which will move these
 * numbers and neither of which is in them yet:
 *
 *   * They assume a gross weight of 125 g per pair. He weighs the goods when
 *     they reach his warehouse and re-quotes if the real weight differs
 *     materially. Nothing has been weighed yet.
 *   * Between 15 October and 15 January every carrier raises its prices, by
 *     roughly 15-25% depending on air freight capacity and fuel, and he passes
 *     that on. The shop's launch sits inside that window, so this table will
 *     need a seasonal re-read before it goes live rather than after.
 *
 * Carrier is YunExpress for every country below. Two countries in the wider
 * quotation use a different one (Iceland via SYPOST, Hong Kong via SF Express)
 * and neither is a market of ours, so the statement holds for this table.
 */
export const SUPPLIER_SHIPPING_USD: Record<
  string,
  [number, number, number, number, number]
> = {
  // ── European Union ──
  AT: [11.31, 13.1, 14.88, 16.98, 18.93], // Austria
  BE: [11.72, 13.92, 16.11, 18.63, 20.98], // Belgium
  BG: [11.23, 13.74, 16.25, 19.08, 21.75], // Bulgaria
  CY: [14.05, 17.6, 21.14, 25.02, 28.72], // Cyprus
  CZ: [10.93, 12.81, 14.68, 16.89, 18.93], // Czechia
  DE: [11.03, 12.69, 14.35, 16.34, 18.16], // Germany
  DK: [12.66, 15.63, 18.6, 21.89, 25.02], // Denmark
  EE: [11.39, 13.72, 16.06, 18.72, 21.22], // Estonia
  ES: [10.41, 12.1, 13.78, 15.79, 17.64], // Spain
  FI: [12.09, 14.16, 16.23, 18.63, 20.86], // Finland
  FR: [10.73, 12.42, 14.1, 16.11, 17.96], // France
  GR: [11.06, 13.4, 15.74, 18.4, 20.9], // Greece
  HR: [13.15, 16.29, 19.43, 22.89, 26.18], // Croatia
  HU: [11.31, 13.4, 15.5, 17.92, 20.18], // Hungary
  IE: [12.09, 14.64, 17.2, 20.08, 22.8], // Ireland
  IT: [11.59, 13.32, 15.06, 17.11, 19.01], // Italy
  LT: [10.93, 12.81, 14.68, 16.89, 18.93], // Lithuania
  LU: [13.29, 16.4, 19.52, 22.95, 26.22], // Luxembourg
  LV: [11, 12.95, 14.9, 17.18, 19.29], // Latvia
  MT: [14.64, 18.63, 22.61, 26.92, 31.06], // Malta
  NL: [12.21, 14.89, 17.56, 20.56, 23.4], // Netherlands
  PL: [10.68, 13.11, 15.55, 18.31, 20.9], // Poland
  PT: [11.51, 13.97, 16.43, 19.21, 21.83], // Portugal
  RO: [11.72, 14.4, 17.08, 20.08, 22.92], // Romania
  SE: [11.52, 13.84, 16.15, 18.79, 21.27], // Sweden
  SI: [13.03, 16.05, 19.06, 22.4, 25.58], // Slovenia
  SK: [11.89, 14.74, 17.59, 20.76, 23.77], // Slovakia
  // ── United Kingdom ──
  GB: [6.15, 7.76, 9.37, 11.31, 13.08],
  // ── The four markets that were missing until 2026-08-21 ──
  // The client set a retail price for the United States, Canada, Australia and
  // New Zealand, and the supplier quoted all four, and neither fact had reached
  // this table. The shop was telling four of its six markets that it does not
  // deliver to their country.
  US: [8.16, 10.98, 13.81, 16.95, 19.94],
  CA: [7.31, 9.29, 11.27, 13.56, 15.7],
  // Australia used to quote the same figure for two and three pairs, which was
  // asked of Daniel as either a real bracket or a typing slip. Quot-260825
  // answers it: a slip. Two pairs is 10.42, not 11.43, and the row now steps
  // like every other. The zero-step guard in `supplierCostUsdCents` stays as a
  // net for the next quotation, but nothing in this table trips it today.
  AU: [9.41, 10.42, 11.43, 12.76, 13.93],
  NZ: [9.03, 11.37, 13.71, 16.37, 18.87],
};

// Countries the supplier also quoted and we deliberately do NOT sell to:
// Switzerland, Norway, Mexico, Iceland, Hong Kong, Japan, the Philippines and
// Singapore. Adding a rate is one line; having no retail price for the market
// and no position on its import tax is the reason they are absent.

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
  // window the quotation still has columns to read as far as five pairs, and
  // past that the cost side's extrapolation is charged - at cost and with no
  // markup, like every other delivery here.
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
 * Question 6 of the supplier document asked exactly what happens above three
 * pairs, and Quot-260825 answers it: the quotation now runs to five. Every
 * parcel the free-shipping window can produce — one to four pairs — is
 * therefore a quoted figure now, not an estimate. That matters because four
 * pairs is the most expensive parcel the shop gives away, so it is the number
 * the whole rule has to justify itself against.
 *
 * ⚠️ Six pairs and up is still extrapolated, by the marginal step between the
 * last two quoted tiers. Those orders are charged, not absorbed, and the
 * supplier has never quoted one, so the estimate is what the customer pays.
 */
export function supplierCostUsdCents(country: string, pairs: number): number {
  const tiers = SUPPLIER_SHIPPING_USD[country];
  if (tiers === undefined || pairs <= 0) return 0;
  if (pairs <= tiers.length) return Math.round(tiers[pairs - 1] * 100);

  // Beyond the quotation, extend by the step between the last two tiers.
  //
  // The zero-step guard is kept even though nothing in the current table trips
  // it. The July quotation gave Australia the same figure for two and three
  // pairs, which would have made the step zero and priced a ten-pair parcel
  // like a three-pair one; August corrected it to a typing slip. The next
  // quotation can carry the same slip, so a zero or negative step is still
  // treated as unknown and the largest step in the row used instead:
  // overstating a cost we are guessing at is the safe direction, because this
  // number decides both what we absorb and, above the free-shipping window,
  // what we charge.
  const last = tiers.length - 1;
  const lastStep = tiers[last] - tiers[last - 1];
  const steps = tiers.slice(1).map((t, i) => t - tiers[i]);
  const step = lastStep > 0 ? lastStep : Math.max(...steps, 0);
  return Math.round((tiers[last] + (pairs - tiers.length) * step) * 100);
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
