// Changing a market price from the admin (C5, section 21 of the brief).
//
// `market_prices` was editable in principle from the day it was created: the
// seed upserts it with `update: {}` precisely so an edit here is not undone by
// the next deploy. What was missing is this: the screen, and two guards.
//
// ── The guards ──────────────────────────────────────────────────────────────
//
// 1. **The same stale-write rule as stock.** A price is written only if the
//    row still holds the figure the person was looking at. Two people editing
//    the same price is rare; one of them silently undoing the other is the
//    kind of thing nobody notices until a customer is charged the old figure.
//
// 2. **A price cannot sell below cost.** The discount codes already refuse to,
//    and a price is the same decision made more permanently: every order in
//    that market at that price is affected, not one basket. So the new figure
//    is checked against the WORST order it can produce — the country in that
//    market whose parcel costs most, at the pair count where delivery is
//    absorbed — with the same arithmetic the checkout uses (`margin.ts`).
//
// ⚠️ `Product.priceCents` is NOT edited here. The seed still replays it from
// `catalogue-source.ts` on every run, so a form for it would lose work. It is
// only a fallback for a market with no row, and every product has all six.

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import type { JWTPayload } from "@/lib/auth";
import { MARKETS, type MarketKey } from "@/lib/markets";
import {
  MAX_PAIRS_PER_ORDER,
  quoteShipping,
  supplierCostUsdCents,
  usdCentsTo,
} from "@/lib/shipping";
import {
  estimatePaymentFeeCents,
  MINIMUM_NET_CENTS,
  netCents,
} from "@/lib/margin";

export type WorstCase = {
  /** What that order leaves, in the market's minor units. */
  netCents: number;
  country: string;
  pairs: number;
};

/**
 * The least any single order can leave at this price, in this market.
 *
 * Every shippable country of the market, every order size the shop accepts.
 * Null when the model's cost is unknown, which is "cannot tell", not "fine".
 */
export function worstCaseNet(
  supplierCostUsd: number | null,
  market: MarketKey,
  priceCents: number,
): WorstCase | null {
  if (supplierCostUsd === null) return null;
  const currency = MARKETS[market].currency;
  const goodsPerPair = usdCentsTo(supplierCostUsd, currency);
  if (goodsPerPair === null) return null;

  let worst: WorstCase | null = null;
  for (const country of MARKETS[market].countries) {
    for (let pairs = 1; pairs <= MAX_PAIRS_PER_ORDER; pairs++) {
      const quote = quoteShipping(country, pairs, currency);
      if (!quote) continue; // not a country the supplier ships to
      const revenueCents = priceCents * pairs + quote.amountCents;
      const net = netCents({
        revenueCents,
        goodsCostCents: goodsPerPair * pairs,
        shippingCostCents:
          usdCentsTo(supplierCostUsdCents(country, pairs), currency) ?? 0,
        paymentFeeCents: estimatePaymentFeeCents(revenueCents, currency),
      });
      if (!worst || net < worst.netCents) worst = { netCents: net, country, pairs };
    }
  }
  return worst;
}

class StaleWrite extends Error {}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

export type PriceChangeResult =
  | { ok: true; changed: string[] }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "stale"; stale: { name: string; priceCents: number | null }[] }
  | { ok: false; reason: "below-cost"; name: string; worst: WorstCase };

/**
 * Set one market's price on one model, or on every model at once.
 *
 * "Every model" exists because the client sells the whole line at one price per
 * market — "no hay ningún colourway premium ni diferencia de precio entre
 * modelos" — so a price change is normally a change to six rows, and doing it
 * six times invites doing it five. It is refused unless every model currently
 * shows the figure the person was looking at: the line is uniform today, and a
 * bulk edit is not the place to find out it stopped being so.
 *
 * All or nothing: one model below cost or one stale row, and nothing is written.
 */
export async function setMarketPrice(input: {
  slug: string;
  market: MarketKey;
  priceCents: number;
  /** The figure on screen. Null when the market had no row. */
  expected: number | null;
  allModels: boolean;
  reason: string;
  actor: JWTPayload;
}): Promise<PriceChangeResult> {
  const { market, priceCents, expected } = input;
  const currency = MARKETS[market].currency;

  const products = await prisma.product.findMany({
    where: input.allModels
      ? { status: { not: "DISCONTINUED" } }
      : { slug: input.slug },
    select: {
      id: true,
      name: true,
      supplierCostUsdCents: true,
      marketPrices: {
        where: { market },
        select: { priceCents: true },
      },
    },
    orderBy: { name: "asc" },
  });
  if (products.length === 0) return { ok: false, reason: "not-found" };

  const stale = products
    .map((p) => ({ name: p.name, priceCents: p.marketPrices[0]?.priceCents ?? null }))
    .filter((p) => p.priceCents !== expected);
  if (stale.length > 0) return { ok: false, reason: "stale", stale };

  for (const p of products) {
    const worst = worstCaseNet(p.supplierCostUsdCents, market, priceCents);
    if (worst && worst.netCents < MINIMUM_NET_CENTS) {
      return { ok: false, reason: "below-cost", name: p.name, worst };
    }
  }

  // The condition is repeated inside the write, so a change that lands between
  // the check above and here still refuses rather than being overwritten. A
  // miss THROWS, because returning from a Prisma transaction commits it, and
  // "all or nothing" would quietly become "the first few".
  let written = true;
  try {
    await prisma.$transaction(async (tx) => {
      for (const p of products) {
        if (expected === null) {
          await tx.marketPrice.create({
            data: { productId: p.id, market, currency, priceCents },
          });
        } else {
          const { count } = await tx.marketPrice.updateMany({
            where: { productId: p.id, market, priceCents: expected },
            data: { priceCents, currency },
          });
          if (count === 0) throw new StaleWrite();
        }
      }
    });
  } catch (error) {
    // A create racing another create hits the unique (product, market) index,
    // which is the same event: somebody else wrote first.
    if (!(error instanceof StaleWrite) && !isUniqueViolation(error)) throw error;
    written = false;
  }

  if (!written) {
    const now = await prisma.marketPrice.findMany({
      where: { market, productId: { in: products.map((p) => p.id) } },
      select: { priceCents: true, product: { select: { name: true } } },
    });
    return {
      ok: false,
      reason: "stale",
      stale: now.map((r) => ({ name: r.product.name, priceCents: r.priceCents })),
    };
  }

  for (const p of products) {
    await recordAudit({
      actor: input.actor,
      action: "update",
      entityType: "market_price",
      entityId: p.id,
      entityLabel: `${p.name} · ${market}`,
      oldValue: { market, currency, priceCents: expected },
      newValue: { market, currency, priceCents, reason: input.reason },
    });
  }

  return { ok: true, changed: products.map((p) => p.name) };
}
