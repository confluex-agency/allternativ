"use client";

import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { trackAddToCart } from "@/lib/tracking";

interface Props {
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string;
  inStock: boolean;
}

export function AddToCartButton({
  productId,
  name,
  slug,
  priceCents,
  imageUrl,
  inStock,
}: Props) {
  const addItem = useCart((s) => s.addItem);

  function handleAdd() {
    addItem({ productId, name, slug, priceCents, quantity: 1, imageUrl });
    trackAddToCart(productId, 1);
  }

  return (
    <Button
      onClick={handleAdd}
      disabled={!inStock}
      className="w-full py-6 text-sm font-medium tracking-wide"
      size="lg"
    >
      {inStock ? "ADD TO CART" : "OUT OF STOCK"}
    </Button>
  );
}
