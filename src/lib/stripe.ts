import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});

export const SUPPORTED_CURRENCIES = [
  "usd",
  "eur",
  "aud",
  "gbp",
  "ars",
  "clp",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
