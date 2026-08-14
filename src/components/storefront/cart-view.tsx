"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/hooks/useCart";
import { formatPrice, STORE_CURRENCY } from "@/lib/utils";
import { caseLabel } from "@/lib/product-options";
import { Button } from "@/components/ui/button";
import { trackCheckoutStart } from "@/lib/tracking";

export function CartView() {
  const cart = useCart();
  const { removeItem, updateQuantity, totalCents, clearCart } = cart;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cart persists in localStorage — unavailable on the server. Treat it as
  // empty until mounted so SSR and the first client render match, then reveal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const items = mounted ? cart.items : [];

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-neutral-500">Your cart is empty.</p>
        <Link
          href="/products"
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
          currency: STORE_CURRENCY.toLowerCase(),
        }),
      });

      if (!res.ok) {
        setError("We could not start the checkout. Please try again.");
        return;
      }

      const { url } = await res.json();
      clearCart();
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
                {formatPrice(item.priceCents)}
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
                {formatPrice(item.priceCents * item.quantity)}
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
        <div className="flex justify-between text-lg font-medium">
          <span>Total</span>
          <span>{formatPrice(totalCents())}</span>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Shipping and any discount code are applied at the next step.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
        <Button
          onClick={handleCheckout}
          disabled={submitting}
          className="w-full mt-6 py-6 text-sm font-medium tracking-wide"
          size="lg"
        >
          {submitting ? "TAKING YOU TO CHECKOUT…" : "CHECKOUT"}
        </Button>
      </div>
    </div>
  );
}
