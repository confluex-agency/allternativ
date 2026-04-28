"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/hooks/useCart";

const NAV_LINKS = [
  { href: "/products", label: "Shop" },
  { href: "/products?type=SUNGLASSES", label: "Sunglasses" },
  { href: "/products?type=OPTICAL", label: "Optical" },
  { href: "/products?type=BLUE_LIGHT", label: "Blue Light" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function StorefrontNavbar() {
  const totalItems = useCart((s) => s.totalItems);
  const count = totalItems();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass border-b-0">
      <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-5 md:h-20 md:px-12">
        <Link
          href="/"
          className="flex items-baseline gap-2"
          aria-label="Allternativ home"
        >
          <span className="eyebrow text-brand-ink fluid-transition">
            Allternativ
          </span>
          <span className="hidden lg:inline text-xs text-brand-muted italic">
            — escape the ordinary
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 lg:gap-10">
          {NAV_LINKS.slice(0, 5).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="eyebrow text-brand-ink-soft fluid-transition hover:text-brand-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
            className="relative grid size-11 place-items-center rounded-full fluid-transition hover:bg-brand-ink/5"
          >
            <ShoppingBag size={18} className="text-brand-ink" strokeWidth={1.5} />
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-brand-ink text-brand-beige text-[10px] font-medium"
              >
                {count}
              </span>
            )}
          </Link>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="grid size-11 place-items-center rounded-full fluid-transition hover:bg-brand-ink/5 md:hidden"
          >
            <Menu size={20} className="text-brand-ink" strokeWidth={1.5} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[60] md:hidden fluid-transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-brand-ink/30 backdrop-blur-sm fluid-transition ${open ? "opacity-100" : "opacity-0"}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          className={`absolute right-0 top-0 h-full w-[85%] max-w-sm glass fluid-transition ${open ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-brand-ink/10">
            <span className="eyebrow text-brand-ink">Allternativ</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid size-11 place-items-center rounded-full fluid-transition hover:bg-brand-ink/5"
            >
              <X size={20} className="text-brand-ink" strokeWidth={1.5} />
            </button>
          </div>
          <ul className="flex flex-col px-6 py-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href} className="border-b border-brand-ink/5 last:border-0">
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between py-4 text-lg text-brand-ink fluid-transition hover:text-brand-ink-soft"
                >
                  {link.label}
                  <span aria-hidden="true" className="text-brand-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="px-6 pt-6">
            <p className="text-xs italic text-brand-muted">
              escape the ordinary
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
