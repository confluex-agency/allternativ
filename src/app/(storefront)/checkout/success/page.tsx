import Link from "next/link";

export const metadata = {
  title: "Order Confirmed",
};

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <div className="text-5xl mb-6">✓</div>
      <h1 className="text-3xl font-light tracking-tight">
        Thank you for your order
      </h1>
      <p className="mt-4 text-neutral-500">
        We&apos;ve received your order and will send you a confirmation email
        shortly.
      </p>
      <Link
        href="/products"
        className="mt-8 inline-block bg-black text-white px-8 py-3 text-sm font-medium tracking-wide hover:bg-neutral-800 transition-colors"
      >
        CONTINUE SHOPPING
      </Link>
    </div>
  );
}
