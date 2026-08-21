import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});

/**
 * The currencies the shop can charge in: one per market, and no others.
 *
 * ⚠️ `ars` and `clp` were removed on 2026-08-21. They were never markets. They
 * are left over from the same period as the "Handcrafted · LATAM" line on the
 * product pages and the Buenos Aires studio address on the contact page, all
 * three removed for the same reason: the shop was describing a business that
 * does not exist. `cad` and `nzd` were missing, and those two ARE markets, so
 * the shop could not have charged Canada or New Zealand at all.
 *
 * Kept in step with `MARKETS` in src/lib/markets.ts, which is what decides
 * which currency a given destination is charged in.
 */
export const SUPPORTED_CURRENCIES = [
  "eur",
  "gbp",
  "usd",
  "cad",
  "aud",
  "nzd",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
