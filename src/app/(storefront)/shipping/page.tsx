import {
  PolicyPage,
  PolicySection,
} from "@/components/storefront/policy-page";
import {
  SHIPPABLE_COUNTRIES,
  quoteShipping,
  DELIVERY_ESTIMATE_BUSINESS_DAYS,
  FREE_SHIPPING_FROM_PAIRS,
  FREE_SHIPPING_MAX_PAIRS,
} from "@/lib/shipping";
import { CARRIER } from "@/lib/legal";
import { formatPrice, STORE_CURRENCY } from "@/lib/utils";

export const metadata = {
  title: "Shipping",
  description:
    "Where we deliver, what it costs, and how long it takes. Tracked delivery on every order.",
};

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

// The rate table is GENERATED from the same figures the checkout charges, never
// typed out beside them. A published price list that has quietly drifted from
// the till is worse than no list at all, and it drifts the first time a rate
// changes and somebody updates one of the two places.
const RATES = SHIPPABLE_COUNTRIES.map((code) => ({
  code,
  name: countryName(code),
  quote: quoteShipping(code, 1),
}))
  .filter((row) => row.quote !== null)
  .sort((a, b) => a.name.localeCompare(b.name));

export default function ShippingPage() {
  return (
    <PolicyPage
      eyebrow="shipping"
      title="Getting it to you."
      standfirst={`Every order ships tracked, to ${RATES.length} countries, with delivery priced at what it actually costs us to send.`}
    >
      <PolicySection title="How long it takes">
        <p>
          <strong className="font-medium text-brand-ink">
            {DELIVERY_ESTIMATE_BUSINESS_DAYS.minimum} to{" "}
            {DELIVERY_ESTIMATE_BUSINESS_DAYS.maximum} business days</strong>{" "}
          from the moment your order is confirmed. That covers one business day
          to pack it and the journey after that.
        </p>
        <p>
          It is a real estimate rather than an optimistic one. Customs can add a
          few days at either end and no carrier controls that, so the window is
          drawn wide enough to be true on a slow week.
        </p>
      </PolicySection>

      <PolicySection title="Tracking">
        <p>
          Everything goes tracked, with {CARRIER} as our standard carrier and an
          alternative only where they do not reach. You get a tracking number
          when the parcel leaves.
        </p>
      </PolicySection>

      <PolicySection title="What delivery costs">
        <p>
          Delivery is charged separately at checkout, calculated from where the
          parcel is going. We pass on what the carrier charges us and add
          nothing to it.
        </p>
        <p>
          <strong className="font-medium text-brand-ink">
            Order {FREE_SHIPPING_FROM_PAIRS} to {FREE_SHIPPING_MAX_PAIRS} pairs
            and delivery is free</strong>, anywhere on the list below.
        </p>
      </PolicySection>

      <PolicySection title={`Where we deliver — ${RATES.length} countries`}>
        <p>
          Prices are for a single pair, in {STORE_CURRENCY}. Choose your country
          in the basket to see your own total before you pay.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[18rem] text-sm">
            <thead>
              <tr className="border-b border-brand-ink/15 text-left">
                <th className="eyebrow py-2 pr-4 font-normal text-brand-muted">
                  Country
                </th>
                <th className="eyebrow py-2 text-right font-normal text-brand-muted">
                  One pair
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {RATES.map((row) => (
                <tr key={row.code} className="border-b border-brand-ink/8">
                  <td className="py-2 pr-4">{row.name}</td>
                  <td className="py-2 text-right">
                    {formatPrice(row.quote!.amountCents, row.quote!.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PolicySection>

      <PolicySection title="If a parcel goes missing">
        <p>
          We send you a replacement. You do not have to chase the carrier for
          us, and you are not out of pocket while it is sorted out.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
