"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  marketForCountry,
  currencyForCountry,
  DEFAULT_MARKET,
  MARKETS,
  type MarketKey,
} from "@/lib/markets";
import type { SupportedCurrency } from "@/lib/stripe";

// Where the parcel is going. ONE choice, three consequences.
//
// It decides the delivery price, the currency shown, and the price shown, and
// that is deliberate rather than convenient. Two controls — "ship to" and
// "price in" — would let somebody take the cheapest market's price and have it
// delivered somewhere else. One cannot, because the checkout pins Stripe's
// allowed countries to this same value and a parcel has to be able to arrive.
//
// It starts EMPTY, not guessed. Nothing here reads an IP or a browser language:
// a visitor behind a VPN, or an Argentinian in Berlin with a Spanish browser,
// would be shown a price that is not theirs, and a wrong price is worse than a
// generic one. Until they choose, everything shows the European market, which
// is the largest. Adding an IP guess later means writing to this store on first
// load and changes nothing else.
//
// ⚠️ The persisted key is the one the cart already used for the same purpose,
// so a basket assembled before this existed keeps its destination.

const STORAGE_KEY = "allternativ:ship-to";

interface DestinationStore {
  /** ISO-2 country code, or "" when the visitor has not chosen. */
  country: string;
  setCountry: (country: string) => void;
}

export const useDestination = create<DestinationStore>()(
  persist(
    (set) => ({
      country: "",
      setCountry: (country) => set({ country }),
    }),
    { name: STORAGE_KEY },
  ),
);

/** The market to price in. The default market until a country is chosen. */
export function marketFor(country: string): MarketKey {
  return (country && marketForCountry(country)) || DEFAULT_MARKET;
}

export function currencyFor(country: string): SupportedCurrency {
  return country
    ? currencyForCountry(country)
    : MARKETS[DEFAULT_MARKET].currency;
}
