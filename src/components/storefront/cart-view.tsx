"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/utils";
import { priceIn, useMarket } from "@/components/storefront/price";
import { useDestination } from "@/hooks/useDestination";
import { MARKETS } from "@/lib/markets";
import { caseLabel } from "@/lib/product-options";
import { Button } from "@/components/ui/button";
import { trackCheckoutStart } from "@/lib/tracking";
import {
  quoteShipping,
  freeShippingMessage,
} from "@/lib/shipping";

// English country names without shipping a list of our own. Falls back to the
// code on the rare browser that cannot do this.
const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

export function CartView() {
  const cart = useCart();
  const { removeItem, updateQuantity, totalCents } = cart;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cart persists in localStorage — unavailable on the server. Treat it as
  // empty until mounted so SSR and the first client render match, then reveal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const items = mounted ? cart.items : [];

  // ── Where it is going ─────────────────────────────────────────────────────
  // Deliberately starts empty instead of guessing a country. Stripe's hosted
  // page cannot recalculate delivery from the address typed on its side, so
  // whatever is chosen here is BOTH the price charged and the only country the
  // payment page will accept. A wrong default would not merely misprice the
  // parcel, it would lock the customer out of entering their real address.
  // The same store the header's picker writes to. One destination for the whole
  // site: choosing in either place settles the price AND the delivery.
  const shipTo = useDestination((s) => s.country);
  const setShipTo = useDestination((s) => s.setCountry);
  const market = useMarket();
  const currency = MARKETS[market].currency;
  // Sorted by the name shown, not by the code, so the list reads alphabetically
  // to the person looking at it rather than to the machine.
  const marketCountries = [...MARKETS[market].countries].sort((a, b) =>
    countryName(a).localeCompare(countryName(b)),
  );

  // ── The discount code ─────────────────────────────────────────────────────
  // It used to be typed on Stripe's hosted page. It moved here because a code
  // applied over there lands on a session that already exists, so it could only
  // ever be watched, not refused, and a deep enough code sells below cost. The
  // field is ours now; the codes are still Stripe's. See src/lib/promotions.ts.
  const [promoCode, setPromoCode] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{
    code: string;
    discountCents: number;
    /** The basket this figure was worked out for. See below. */
    signature: string;
  } | null>(null);

  const pairs = items.reduce((n, i) => n + i.quantity, 0);
  const shipping = shipTo ? quoteShipping(shipTo, pairs, currency) : null;
  const nudge = freeShippingMessage(pairs);

  // What a discount is worth depends on the whole basket, not just the code:
  // the same percentage comes off a different subtotal, and the floor it has to
  // clear moves with the freight, which moves with the destination. So an
  // applied figure is only good for the basket it was worked out for.
  //
  // Compared rather than cleared in an effect, so adding a pair simply makes
  // the discount go stale in the same render instead of leaving a stale number
  // on screen for a frame. The server recomputes regardless: this only decides
  // what the customer is shown.
  const basketSignature = [
    shipTo,
    market,
    ...items.map((i) => `${i.variantId}:${i.caseColor}:${i.quantity}`).sort(),
  ].join("|");
  const discount =
    applied && applied.signature === basketSignature ? applied : null;
  const staleDiscount = applied !== null && discount === null;

  // Priced from each line's own market table rather than from the figure
  // stored when it was added, so a basket assembled in euros reprices whole
  // when somebody changes where it is going.
  const lineCents = (i: (typeof items)[number]) =>
    priceIn(i.prices, market, i.priceCents).cents;
  const subtotalCents = items.reduce(
    (sum, i) => sum + lineCents(i) * i.quantity,
    0,
  );
  const grandTotalCents =
    subtotalCents - (discount?.discountCents ?? 0) + (shipping?.amountCents ?? 0);

  async function handleApplyCode() {
    const code = promoCode.trim();
    if (!code) return;
    if (!shipTo) {
      // Not a technicality. The floor a code has to clear depends on what the
      // parcel costs to send, so there is no answer before there is a country.
      setPromoError("Choose where it is going first.");
      return;
    }

    setPromoError(null);
    setCheckingCode(true);
    try {
      const res = await fetch("/api/promotions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            caseColor: i.caseColor,
          })),
          currency,
          destinationCountry: shipTo,
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setApplied(null);
        setPromoError(
          typeof body?.error === "string"
            ? body.error
            : "That code is not valid for this order.",
        );
        return;
      }

      setApplied({
        code: body.code,
        discountCents: body.discountCents,
        signature: basketSignature,
      });
    } catch {
      setApplied(null);
      setPromoError("We could not check that code. Please try again.");
    } finally {
      setCheckingCode(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-neutral-500">Your cart is empty.</p>
        <Link
          href="/collections"
          className="mt-4 inline-block text-sm underline hover:text-black"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  async function handleCheckout() {
    trackCheckoutStart(items.length, totalCents());
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Variant ids, not product codes: the checkout prices against the
          // buyable colourway, and the case colour has to reach the supplier.
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            caseColor: i.caseColor,
          })),
          currency,
          destinationCountry: shipTo,
          ...(promoCode.trim() ? { promotionCode: promoCode.trim() } : {}),
        }),
      });

      if (!res.ok) {
        // The server's own words when it has them. A rejected code, or a
        // colourway that sold out while the basket sat open, are things the
        // customer can act on, and "please try again" tells them none of it.
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "We could not start the checkout. Please try again.",
        );
        return;
      }

      const { url } = await res.json();
      // The basket is NOT emptied here. Leaving for the payment page is not the
      // same as paying: people change their mind, lose signal, or come back
      // tomorrow, and finding an empty cart is how a sale gets thrown away.
      // It is cleared on the confirmation page, once the payment is real.
      window.location.href = url;
    } catch {
      setError("We could not reach the payment provider. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="space-y-6">
        {items.map((item) => (
          <div
            key={item.lineId}
            className="flex items-center gap-4 pb-6 border-b"
          >
            <div className="relative w-20 h-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
              {item.imageUrl && (
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-contain"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/products/${item.slug}`}
                className="text-sm font-medium hover:underline"
              >
                {item.name}
              </Link>
              {/* Section 13: the cart must show model, eyewear colour and the
                  chosen case, and that choice stays visible through checkout. */}
              <p className="mt-1 text-xs text-neutral-500">
                {item.variantName} · Case: {caseLabel(item.caseColor)}
              </p>
              <p className="text-sm text-neutral-500 mt-1">
                {formatPrice(lineCents(item), currency)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                  aria-label="Decrease quantity"
                  className="w-7 h-7 border text-sm hover:bg-neutral-100"
                >
                  -
                </button>
                <span className="text-sm w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                  aria-label="Increase quantity"
                  className="w-7 h-7 border text-sm hover:bg-neutral-100"
                >
                  +
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">
                {formatPrice(lineCents(item) * item.quantity, currency)}
              </p>
              <button
                onClick={() => removeItem(item.lineId)}
                className="text-xs text-neutral-400 hover:text-red-600 mt-1"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t">
        {/* The client asked for the delivery cost to be visible here rather
            than folded into the price: "No queremos incorporar artificialmente
            el shipping dentro del retail price." */}
        {/* Only the countries of the chosen market, which is why the header's
            picker can stay at six entries. Outside Europe a market is one
            country, so there is nothing to ask and asking would be noise: the
            destination is stated instead, with the header as the way to change
            it. */}
        {marketCountries.length === 1 ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              Ship to
            </span>
            <span className="text-sm text-neutral-800">
              {countryName(marketCountries[0])}
            </span>
          </div>
        ) : (
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              Ship to
            </span>
            <select
              value={shipTo}
              onChange={(e) => setShipTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select a country…</option>
              {marketCountries.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Both inputs sit together, above the money, because both of them
            change the money underneath. */}
        <div className="mt-5">
          <label htmlFor="promo" className="block">
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              Discount code
            </span>
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="promo"
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                // Editing the code retracts whatever was applied. Leaving the
                // old saving on screen under a different code is the one thing
                // this field must never do.
                setApplied(null);
                setPromoError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApplyCode();
                }
              }}
              placeholder="Optional"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm uppercase placeholder:normal-case placeholder:text-neutral-400"
            />
            <button
              type="button"
              onClick={handleApplyCode}
              disabled={!promoCode.trim() || checkingCode}
              className="shrink-0 rounded-lg border border-neutral-900 px-4 py-2 text-xs font-medium uppercase tracking-wide text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400 disabled:hover:bg-transparent"
            >
              {checkingCode ? "Checking…" : "Apply"}
            </button>
          </div>
          {promoError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {promoError}
            </p>
          )}
          {staleDiscount && (
            <p className="mt-2 text-sm text-amber-700">
              Your basket changed. Apply the code again to see the new saving.
            </p>
          )}
        </div>

        <div className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal</span>
            <span>{formatPrice(subtotalCents, currency)}</span>
          </div>
          {discount && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount ({discount.code})</span>
              <span>−{formatPrice(discount.discountCents, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-neutral-600">
            <span>Shipping</span>
            <span>
              {!shipping ? (
                <span className="text-neutral-400">Select a country</span>
              ) : shipping.free ? (
                <span className="font-medium text-emerald-700">Free</span>
              ) : (
                formatPrice(shipping.amountCents, shipping.currency)
              )}
            </span>
          </div>
        </div>

        <div className="mt-3 flex justify-between border-t pt-3 text-lg font-medium">
          <span>Total</span>
          <span>{formatPrice(grandTotalCents, currency)}</span>
        </div>

        {/* Their copy, word for word. This is the lever they want to measure,
            so paraphrasing it would break the comparison. */}
        {nudge && (
          <p
            className={`mt-3 text-sm ${
              shipping?.free ? "text-emerald-700" : "text-neutral-700"
            }`}
          >
            {nudge}
          </p>
        )}

        <p className="mt-2 text-xs text-neutral-500">
          Tracked delivery, 8–15 business days.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
        {/* Disabled until a destination is chosen: without it there is no
            delivery price to quote and no country to pin the payment page to. */}
        <Button
          onClick={handleCheckout}
          disabled={submitting || !shipTo}
          className="w-full mt-6 py-6 text-sm font-medium tracking-wide"
          size="lg"
        >
          {submitting
            ? "TAKING YOU TO CHECKOUT…"
            : !shipTo
              ? "CHOOSE A DESTINATION"
              : "CHECKOUT"}
        </Button>
      </div>
    </div>
  );
}
