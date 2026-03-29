"use client";

import Link from "next/link";
import { useCart } from "@/hooks/useCart";

export function StorefrontNavbar() {
  const totalItems = useCart((s) => s.totalItems);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-xl font-light tracking-[0.2em] uppercase"
        >
          Allternativ
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm">
          <Link
            href="/products"
            className="text-neutral-600 hover:text-black transition-colors"
          >
            Shop
          </Link>
          <Link
            href="/products?type=SUNGLASSES"
            className="text-neutral-600 hover:text-black transition-colors"
          >
            Sunglasses
          </Link>
          <Link
            href="/products?type=OPTICAL"
            className="text-neutral-600 hover:text-black transition-colors"
          >
            Optical
          </Link>
          <Link
            href="/products?type=BLUE_LIGHT"
            className="text-neutral-600 hover:text-black transition-colors"
          >
            Blue Light
          </Link>
        </div>

        <div className="flex items-center gap-6">
          <Link
            href="/cart"
            className="relative text-sm text-neutral-600 hover:text-black transition-colors"
          >
            Cart
            {totalItems() > 0 && (
              <span className="absolute -top-2 -right-4 bg-black text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {totalItems()}
              </span>
            )}
          </Link>
        </div>
      </nav>
    </header>
  );
}
