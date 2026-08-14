import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Selling currency. The brief prices everything in euros ("€XX"); the figure per
 * model is still to be confirmed by the client. Change it here only.
 */
export const STORE_CURRENCY = "EUR";

/**
 * Shop-facing price: whole units, no cents. Sunglasses are priced at round
 * numbers, and "€189.00" reads like an invoice. Use formatCurrency instead
 * wherever the exact amount matters, such as orders and refunds.
 */
export function formatPrice(cents: number, currency = STORE_CURRENCY): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatCurrency(cents: number, currency = STORE_CURRENCY): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: currency === "clp" || currency === "CLP" ? 0 : 2,
  }).format(cents / 100);
}

export function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `ALT-${y}${m}${d}-${rand}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
