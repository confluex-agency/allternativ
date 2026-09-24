"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useCartDrawer } from "@/hooks/useCartDrawer";
import { useDestination } from "@/hooks/useDestination";
import { priceIn, useMarket } from "@/components/storefront/price";
import { caseLabel } from "@/lib/product-options";
import {
  freeShippingMessage,
  orderLimitMessage,
  pairsLeftInOrder,
} from "@/lib/shipping";
import { formatPrice } from "@/lib/utils";
import { MARKETS } from "@/lib/markets";
import type { CartItem } from "@/types";

// The basket, without leaving the page you are on.
//
// ── What this is for ────────────────────────────────────────────────────────
//
// Before it existed the shop went: add a pair, watch the button say ADDED for
// two seconds, and then have no way to see what was in the basket except by
// navigating away from the product. That jump is friction at the exact moment
// somebody has decided they want the thing, and it is the moment a second pair
// is most likely to be added.
//
// So this panel is NOT a second checkout. It confirms the add, says what the
// basket is worth, tells you how close free delivery is, and then gets out of
// the way so you can keep looking.
//
// ⚠️ **It deliberately does not end in a payment.** The real checkout needs two
// things this panel does not ask for — the destination country, which pins
// `allowed_countries` on the Stripe session and therefore has to be settled
// before that session exists, and the discount code, which is refused below the
// margin floor before any money moves. Both live in `/cart`, and "Proceed to
// checkout" goes there. A button that sometimes skipped that page and sometimes
// did not would be a support ticket nobody could reproduce.
//
// Built on the base-ui Dialog rather than hand-rolled like the mobile menu in
// `navbar.tsx`, because this one traps focus, closes on Escape and locks the
// background scroll without any of that being written here and forgotten.

/** The server's basket, and the same object every time. See the note below. */
const EMPTY_BASKET: CartItem[] = [];

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

export function CartDrawer() {
  const open = useCartDrawer((s) => s.open);
  const setOpen = useCartDrawer((s) => s.setOpen);
  const closeCart = useCartDrawer((s) => s.closeCart);

  const updateQuantity = useCart((s) => s.updateQuantity);
  const removeItem = useCart((s) => s.removeItem);

  const market = useMarket();
  const currency = MARKETS[market].currency;
  const shipTo = useDestination((s) => s.country);

  // The basket lives in localStorage, which the server cannot read, so the
  // server's HTML and the first client pass have to agree on "empty".
  //
  // `useSyncExternalStore` with an explicit server snapshot rather than a
  // `mounted` flag flipped in an effect, for the reason the navbar counter
  // already carries: setting state in an effect schedules a second render of
  // everything below it, which React's compiler rules refuse — and this
  // component re-renders a whole list. React provides this hook for exactly
  // this situation; it renders the server snapshot during hydration and swaps
  // to the real one immediately after.
  const lines = useSyncExternalStore(
    useCart.subscribe,
    () => useCart.getState().items,
    // ⚠️ Must be the same reference every call. A fresh `[]` here is a new
    // object on every render, which React reads as "the store changed" — and
    // that is an infinite render loop, not a slow page.
    () => EMPTY_BASKET,
  );

  const lineCents = (item: CartItem) =>
    priceIn(item.prices, market, item.priceCents).cents;

  const pairs = lines.reduce((n, i) => n + i.quantity, 0);
  const subtotalCents = lines.reduce(
    (sum, i) => sum + lineCents(i) * i.quantity,
    0,
  );

  // The client's own copy, word for word, and the same function `/cart` calls.
  // This is the lever they want to measure, so the two places must not drift
  // into two slightly different sentences.
  const nudge = freeShippingMessage(pairs);
  const freeAlready = pairs >= 2;
  // C3: three pairs per order. The + buttons stop at it, and this says why.
  const bagFull = pairsLeftInOrder(pairs) === 0;
  const limit = orderLimitMessage(pairs);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-brand-ink/30 backdrop-blur-sm transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-[80] flex h-full w-full max-w-md flex-col border-l border-brand-ink/10 bg-brand-beige/95 backdrop-blur-2xl transition-transform duration-300 data-ending-style:translate-x-full data-starting-style:translate-x-full">
          <div className="flex items-center justify-between border-b border-brand-ink/10 px-6 py-5">
            <Dialog.Title className="eyebrow text-brand-ink">
              Your bag{pairs > 0 ? ` (${pairs})` : ""}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close bag"
              className="grid size-11 place-items-center rounded-full fluid-transition hover:bg-brand-ink/5"
            >
              <X size={20} className="text-brand-ink" strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          {lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
              <p className="text-base text-brand-ink-soft">
                Nothing in here yet.
              </p>
              <Link
                href="/collections"
                onClick={closeCart}
                className="eyebrow rounded-full border border-brand-ink/20 px-6 py-3 text-brand-ink fluid-transition hover:bg-brand-ink/5"
              >
                Browse the collections
              </Link>
            </div>
          ) : (
            <>
              <ul className="flex-1 divide-y divide-brand-ink/10 overflow-y-auto px-6">
                {lines.map((item) => (
                  <li key={item.lineId} className="flex gap-4 py-5">
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={closeCart}
                      className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-brand-ink/5"
                    >
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-contain"
                        />
                      )}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={`/products/${item.slug}`}
                        onClick={closeCart}
                        className="text-sm text-brand-ink fluid-transition hover:text-brand-ink-soft"
                      >
                        {item.name}
                      </Link>
                      {/* Section 13: the colourway AND its case stay visible
                          from here through to the confirmation. The case
                          never appears in the name. */}
                      <p className="mt-0.5 text-xs text-brand-muted">
                        {item.variantName} · Case: {caseLabel(item.caseColor)}
                      </p>

                      <div className="mt-auto flex items-center gap-3 pt-3">
                        <div className="flex items-center rounded-full border border-brand-ink/15">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.lineId, item.quantity - 1)
                            }
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="grid size-8 place-items-center rounded-full text-brand-ink fluid-transition hover:bg-brand-ink/5"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm text-brand-ink">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.lineId, item.quantity + 1)
                            }
                            disabled={bagFull}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="grid size-8 place-items-center rounded-full text-brand-ink fluid-transition hover:bg-brand-ink/5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.lineId)}
                          className="text-xs text-brand-muted underline underline-offset-4 fluid-transition hover:text-brand-ink"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <p className="shrink-0 text-sm text-brand-ink">
                      {formatPrice(lineCents(item) * item.quantity, currency)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="border-t border-brand-ink/10 px-6 py-5">
                {/* ── The free-delivery lever ───────────────────────────────
                    The client's AOV play is that delivery is free and absorbed
                    whole from two pairs up. It used to be said only once the
                    visitor had already walked to the basket page; said here it
                    lands while they are still browsing, which is the only
                    moment at which it can change what they do. */}
                {nudge && (
                  <p
                    className={`mb-4 text-sm ${freeAlready ? "text-emerald-800" : "text-brand-ink"}`}
                  >
                    {nudge}
                  </p>
                )}
                {limit && (
                  <p className="-mt-2 mb-4 text-xs text-brand-muted">
                    {limit}
                  </p>
                )}

                <div className="flex items-baseline justify-between">
                  <span className="eyebrow text-brand-muted">Subtotal</span>
                  <span className="text-base text-brand-ink">
                    {formatPrice(subtotalCents, currency)}
                  </span>
                </div>

                {/* ── Where it is going ─────────────────────────────────────
                    Shown rather than editable, and never guessed. The chosen
                    country sets the currency AND is the only country Stripe's
                    payment page will accept an address in, so somebody who
                    reaches the payment page with the wrong one cannot enter
                    their real address at all. Choosing it is one screen on. */}
                <p className="mt-1.5 text-xs text-brand-muted">
                  {shipTo ? (
                    <>
                      Delivering to {countryName(shipTo)}. Delivery and any
                      discount code are worked out in the bag.
                    </>
                  ) : (
                    <>
                      Choose where it is going in the bag — it sets the price and
                      the only country the payment page will accept.
                    </>
                  )}
                </p>

                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="eyebrow mt-5 block w-full rounded-full bg-brand-ink px-6 py-4 text-center text-brand-beige fluid-transition hover:opacity-90"
                >
                  Proceed to checkout
                </Link>
                <button
                  type="button"
                  onClick={closeCart}
                  className="mt-3 block w-full text-center text-xs text-brand-muted underline underline-offset-4 fluid-transition hover:text-brand-ink"
                >
                  Keep looking
                </button>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
