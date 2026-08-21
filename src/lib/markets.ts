// The six markets, and what a pair costs in each.
//
// The client's decision, in their own words: "no queremos simplemente hacer una
// conversión automática del EUR price cada día. Queremos utilizar los precios
// regionales definidos... esto nos permite controlar exactamente cómo se
// posiciona el producto en cada mercado."
//
// So these are not conversions and no exchange rate touches them. They are six
// prices somebody chose. Read across them in dollars and the intent is plain:
// USD 45.00 to 46.48, a spread of 3%, six numbers aimed at the same shelf.
//
// ── A market is derived from a country, never chosen separately ─────────────
// The visitor picks where the parcel is going, once, and that decides both the
// delivery price and the currency. Two controls would let somebody take the
// cheapest market's price and have it delivered somewhere else; one control
// cannot, because the checkout pins Stripe to that same country and a parcel
// has to be able to arrive.
//
// ⚠️ `MARKET_PRICE_CENTS` is the SOURCE, not the authority. The seed writes it
// into the database and the checkout prices against the database, because the
// basket lives in the visitor's browser and section 21 of the brief asks for a
// per-market price the client can edit without a deploy.

import type { SupportedCurrency } from "@/lib/stripe";

export type MarketKey = "EU" | "GB" | "US" | "CA" | "AU" | "NZ";

/** The 27 EU countries the supplier quoted. One market, one price, one currency. */
const EU_COUNTRIES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK",
];

export const MARKETS: Record<
  MarketKey,
  { label: string; currency: SupportedCurrency; countries: string[] }
> = {
  EU: { label: "Europe", currency: "eur", countries: EU_COUNTRIES },
  GB: { label: "United Kingdom", currency: "gbp", countries: ["GB"] },
  US: { label: "United States", currency: "usd", countries: ["US"] },
  CA: { label: "Canada", currency: "cad", countries: ["CA"] },
  AU: { label: "Australia", currency: "aud", countries: ["AU"] },
  NZ: { label: "New Zealand", currency: "nzd", countries: ["NZ"] },
};

/**
 * What a pair sells for, in each market's minor units.
 *
 * Every model and every colourway carries the same price inside a market:
 * "no hay ningún colourway premium ni diferencia de precio entre modelos."
 * Held per product all the same, because that is the shape section 21 asks the
 * admin to edit, and a single number would have to be taken apart later.
 */
export const MARKET_PRICE_CENTS: Record<MarketKey, number> = {
  EU: 3900, // €39
  GB: 3400, // £34
  US: 4500, // $45
  CA: 6400, // CA$64
  AU: 6400, // AU$64
  NZ: 7600, // NZ$76
};

/** The market a shipping country belongs to, or null if we do not sell there. */
export function marketForCountry(country: string): MarketKey | null {
  const code = country.toUpperCase();
  for (const key of Object.keys(MARKETS) as MarketKey[]) {
    if (MARKETS[key].countries.includes(code)) return key;
  }
  return null;
}

/** Every country we sell to, across all six markets. */
export const SELLABLE_COUNTRIES = Object.values(MARKETS)
  .flatMap((m) => m.countries)
  .sort();

export const DEFAULT_MARKET: MarketKey = "EU";

export function currencyForCountry(country: string): SupportedCurrency {
  const market = marketForCountry(country);
  return market ? MARKETS[market].currency : MARKETS[DEFAULT_MARKET].currency;
}
