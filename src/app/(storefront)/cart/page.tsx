import { CartView } from "@/components/storefront/cart-view";

export const metadata = {
  title: "Cart",
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-light tracking-tight mb-8">Your Cart</h1>
      <CartView />
    </div>
  );
}
