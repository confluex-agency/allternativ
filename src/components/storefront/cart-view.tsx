"use client";

import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { trackCheckoutStart } from "@/lib/tracking";

export function CartView() {
  const { items, removeItem, updateQuantity, totalCents, clearCart } = useCart();

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

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        currency: "usd",
      }),
    });

    if (res.ok) {
      const { url } = await res.json();
      clearCart();
      window.location.href = url;
    }
  }

  return (
    <div>
      <div className="space-y-6">
        {items.map((item) => (
          <div
            key={item.productId}
            className="flex items-center gap-4 pb-6 border-b"
          >
            <div className="w-20 h-20 bg-neutral-100 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Link
                href={`/products/${item.slug}`}
                className="text-sm font-medium hover:underline"
              >
                {item.name}
              </Link>
              <p className="text-sm text-neutral-500 mt-1">
                {formatCurrency(item.priceCents)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() =>
                    updateQuantity(item.productId, item.quantity - 1)
                  }
                  className="w-7 h-7 border text-sm hover:bg-neutral-100"
                >
                  -
                </button>
                <span className="text-sm w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() =>
                    updateQuantity(item.productId, item.quantity + 1)
                  }
                  className="w-7 h-7 border text-sm hover:bg-neutral-100"
                >
                  +
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">
                {formatCurrency(item.priceCents * item.quantity)}
              </p>
              <button
                onClick={() => removeItem(item.productId)}
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
          <span>{formatCurrency(totalCents())}</span>
        </div>
        <Button
          onClick={handleCheckout}
          className="w-full mt-6 py-6 text-sm font-medium tracking-wide"
          size="lg"
        >
          CHECKOUT
        </Button>
      </div>
    </div>
  );
}
