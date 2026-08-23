"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  marketForCountry,
  DEFAULT_MARKET,
  MARKETS,
  type MarketKey,
} from "@/lib/markets";
import { detectMarket } from "@/lib/market-detect";

// Where the parcel is going. Two fields, and they are not the same question.
//
//   market  — decides the PRICE and the CURRENCY. Six values. Guessed on the
//             first visit from the browser's time zone, changed in the header.
//   country — decides the DELIVERY PRICE. Thirty-two values, and only ever a
//             real question inside Europe: the other five markets are one
//             country each, so choosing the market answers it.
//
// Splitting them is what lets the header offer six choices instead of
// thirty-two. The first version put all thirty-two in the header and it read
// as a form to fill in rather than a price to notice.
//
// ⚠️ They still cannot disagree. Setting a market drops a country that does not
// belong to it, and setting a country adopts that country's market. Otherwise
// somebody could hold the cheapest market's price against the dearest market's
// delivery, and the checkout would have to referee it.

const STORAGE_KEY = "allternativ:destination";

interface DestinationStore {
  /** Null until guessed or chosen. Null shows the default market. */
  market: MarketKey | null;
  /** ISO-2 country. "" when the market has more than one and none is picked. */
  country: string;
  setMarket: (market: MarketKey) => void;
  setCountry: (country: string) => void;
}

export const useDestination = create<DestinationStore>()(
  persist(
    (set, get) => ({
      market: null,
      country: "",

      setMarket: (market) => {
        const countries = MARKETS[market].countries;
        set({
          market,
          // One-country markets answer the delivery question by themselves.
          // Europe keeps a country the visitor already chose, and clears one
          // that belongs somewhere else.
          country:
            countries.length === 1
              ? countries[0]
              : countries.includes(get().country)
                ? get().country
                : "",
        });
      },

      setCountry: (country) =>
        set({
          country,
          market: (country && marketForCountry(country)) || get().market,
        }),
    }),
    {
      name: STORAGE_KEY,
      // The guess happens HERE, after the browser has said what it remembers,
      // and only when it remembers nothing. Doing it in a React effect would
      // schedule a second render of every price on the page; doing it before
      // rehydration would overwrite a choice somebody already made.
      onRehydrateStorage: () => (state) => {
        if (!state || state.market) return;
        const guessed = detectMarket();
        if (guessed) state.setMarket(guessed);
      },
    },
  ),
);

/** The market to price in: the chosen or guessed one, or the default. */
export function effectiveMarket(market: MarketKey | null): MarketKey {
  return market ?? DEFAULT_MARKET;
}
