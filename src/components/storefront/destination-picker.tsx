"use client";

import { useDestination } from "@/hooks/useDestination";
import { useMarket } from "@/components/storefront/price";
import { MARKETS, SELLABLE_COUNTRIES, DEFAULT_MARKET } from "@/lib/markets";

// Where the parcel is going, chosen once, in the header.
//
// It sits here rather than only in the basket because it decides the PRICE, and
// a price has to be right on the first page somebody sees, not corrected three
// pages later. The basket reads the same store, so choosing in either place
// settles both.
//
// The label shows the market and its currency rather than the country, because
// what changes visibly is the money: "Europe · EUR" explains why the figure
// below it is in euros in a way "Germany" does not.

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

const OPTIONS = SELLABLE_COUNTRIES.map((code) => ({
  code,
  name: countryName(code),
})).sort((a, b) => a.name.localeCompare(b.name));

export function DestinationPicker({ className = "" }: { className?: string }) {
  const country = useDestination((s) => s.country);
  const setCountry = useDestination((s) => s.setCountry);
  const market = useMarket();

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">Deliver to</span>
      <span
        aria-hidden="true"
        className="eyebrow pointer-events-none absolute left-3 text-brand-ink-soft"
        suppressHydrationWarning
      >
        {MARKETS[market].label} &middot;{" "}
        {MARKETS[market].currency.toUpperCase()}
      </span>
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className="h-9 w-[13.5rem] cursor-pointer appearance-none rounded-full border border-brand-ink/15 bg-transparent pr-3 pl-3 text-transparent fluid-transition hover:border-brand-ink/40"
      >
        {/* Empty stays selectable: somebody who picked the wrong country needs a
            way back to "not chosen", and the default market is a truthful thing
            to show while nobody has said where they are. */}
        <option value="">
          {MARKETS[DEFAULT_MARKET].label} (default)
        </option>
        {OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
