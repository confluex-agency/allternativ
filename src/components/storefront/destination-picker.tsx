"use client";

import { ChevronDown } from "lucide-react";
import { useDestination } from "@/hooks/useDestination";
import { useMarket } from "@/components/storefront/price";
import { MARKETS, type MarketKey } from "@/lib/markets";

// The market, in the header. Six choices, not thirty-two.
//
// The first version of this listed every country we deliver to, and opening it
// was a wall. It was also answering the wrong question: what changes in the
// header is the MONEY, and money has six values here, not thirty-two. Which
// country in Europe a parcel goes to changes the delivery price, so it belongs
// in the basket beside the delivery line, and nowhere else.
//
// Nobody normally has to touch this. The market is guessed from the browser's
// time zone on the first visit; the control exists for when the guess is wrong,
// which is the whole reason a guess is allowed to be made at all.
//
// ── Why the select is invisible and the label is not ───────────────────────
// A native <select> cannot be styled to sit in this header, and a hand-built
// dropdown would have to reimplement keyboard handling, typeahead and the
// native picker phones show. So the visible part is ordinary markup and the
// real select lies on top at zero opacity: full native behaviour, nothing
// reimplemented.
//
// An earlier attempt dimmed the select's own text with `text-transparent`
// instead. That was a trap: on Windows the <option> rows inherit their colour
// from the select, so the whole dropdown would have opened blank.

const ORDER: MarketKey[] = ["EU", "GB", "US", "CA", "AU", "NZ"];

export function DestinationPicker({ className = "" }: { className?: string }) {
  const setMarket = useDestination((s) => s.setMarket);
  const market = useMarket();

  return (
    // Intrinsic width: "United Kingdom · GBP" is a third longer than
    // "Europe · EUR", and a fixed box would clip the longest of the six.
    <div
      className={`relative inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-ink/15 px-3 fluid-transition focus-within:border-brand-ink/60 hover:border-brand-ink/40 ${className}`}
    >
      <span
        className="eyebrow whitespace-nowrap text-brand-ink-soft"
        suppressHydrationWarning
      >
        {MARKETS[market].label} &middot;{" "}
        {MARKETS[market].currency.toUpperCase()}
      </span>
      <ChevronDown
        size={14}
        strokeWidth={1.5}
        aria-hidden="true"
        className="shrink-0 text-brand-muted"
      />
      <select
        aria-label="Shipping destination and currency"
        value={market}
        onChange={(e) => setMarket(e.target.value as MarketKey)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 opacity-0 [&>option]:text-black"
      >
        {ORDER.map((key) => (
          <option key={key} value={key}>
            {MARKETS[key].label} ({MARKETS[key].currency.toUpperCase()})
          </option>
        ))}
      </select>
    </div>
  );
}
