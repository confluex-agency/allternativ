"use client";

import { useEffect } from "react";
import { useCart } from "@/hooks/useCart";

// Empties the basket once, and only on the confirmation page.
//
// Deliberately not done when the shopper leaves for Stripe: abandoning a payment
// is common and normal, and coming back to an empty cart means starting over,
// which is how a sale gets lost. The basket survives until the money is real.

export function ClearCartOnSuccess() {
  const clearCart = useCart((s) => s.clearCart);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return null;
}
