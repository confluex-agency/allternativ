"use client";

import { useSyncExternalStore } from "react";
import { useDestination, marketFor } from "@/hooks/useDestination";
import { formatPrice } from "@/lib/utils";
import { MARKETS, DEFAULT_MARKET, type MarketKey } from "@/lib/markets";

// One price, in the currency of wherever the parcel is going.
//
// Every market's figure is already on the page: the product pages are
// statically generated and the destination is a choice the browser holds, so
// the server cannot know which one to print. Rather than give up static
// rendering or fetch a number, all six travel with the page and this picks.
//
// ⚠️ It renders the DEFAULT market on the server and on the first client paint,
// then switches. That order is not incidental. Reading persisted state during
// the first render makes the server's HTML and the client's first pass
// disagree, and React discards the whole tree; worse, it would flash a price
// that changes under the reader's eye without them touching anything. The
// default market is the largest one, so most people never see a switch at all.

type PriceMap = Record<string, { currency: string; cents: number }> | undefined;

/** The market's figure, falling back to the default market, then to euros. */
export function priceIn(
  prices: PriceMap,
  market: MarketKey,
  fallbackCents: number,
): { cents: number; currency: string } {
  const chosen = prices?.[market] ?? prices?.[DEFAULT_MARKET];
  if (chosen) return { cents: chosen.cents, currency: chosen.currency };
  return {
    cents: fallbackCents,
    currency: MARKETS[DEFAULT_MARKET].currency,
  };
}

/**
 * The market to price in right now. The default one until the browser has both
 * mounted and read what it stored.
 *
 * `useSyncExternalStore` rather than a `mounted` flag set in an effect. It is
 * the mechanism React provides for exactly this: a value the server cannot
 * know, with an explicit server snapshot, resolved without a render pass that
 * lies. Setting state in an effect to achieve the same thing schedules a second
 * render of everything below it, which React's own compiler rules now refuse.
 */
export function useMarket(): MarketKey {
  const country = useSyncExternalStore(
    useDestination.subscribe,
    () => useDestination.getState().country,
    // The server has no browser storage to read, so it always renders the
    // default market. The client's first pass agrees, then updates.
    () => "",
  );
  return marketFor(country);
}

export function Price({
  prices,
  fallbackCents,
  className,
}: {
  prices: PriceMap;
  fallbackCents: number;
  className?: string;
}) {
  const market = useMarket();
  const { cents, currency } = priceIn(prices, market, fallbackCents);
  return (
    <span className={className} suppressHydrationWarning>
      {formatPrice(cents, currency)}
    </span>
  );
}
