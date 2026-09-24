// The other half of the subtraction: what each sale actually left.
//
// Section 12 of the client's answer of 2026-09-21 asked for a costs and
// margins screen, and the data for it has been frozen on every order since
// 2026-08-20 (`OrderItem.unitCostCents`, `Order.shippingCostCents`,
// `Order.paymentFeeCents`). The proposal behind it is in the vault, "Admin -
// area de costos y margen (propuesta)".
//
// ⚠️ COMMERCIAL_ROLES only. This is what Allternativ pays the supplier and what
// it keeps, and section 18 gives neither CONTENT_ADMIN nor ANALYTICS_VIEWER
// anything to do with finance.
//
// ⚠️ It reads the FROZEN figures, never today's catalogue. The whole point of
// freezing the cost on the order was that a supplier price rise must not
// reprice last quarter backwards. A null frozen figure is shown as unknown,
// never as zero: zero reads as "free" and quietly inflates the margin.

import { prisma } from "@/lib/prisma";
import { MARKETS, type MarketKey } from "@/lib/markets";
import { FX } from "@/lib/shipping";

/** Paid and not undone. The same list the dashboard counts. */
const REAL_ORDERS = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/** Above this a price or a rate has drifted enough to be worth a decision. */
export const DRIFT_ALERT_PERCENT = 5;

export type OrderMargin = {
  id: string;
  orderNumber: string;
  at: Date;
  currency: string;
  pairs: number;
  country: string | null;
  revenueCents: number;
  discountCents: number;
  goodsCents: number | null;
  shippingCostCents: number | null;
  /** True when the customer paid nothing for delivery and we did. */
  shippingAbsorbed: boolean;
  feeCents: number | null;
  /** Null when any cost is unknown: a partial subtraction is not a margin. */
  netCents: number | null;
};

export type CurrencyTotals = {
  currency: string;
  orders: number;
  revenueCents: number;
  goodsCents: number;
  shippingCostCents: number;
  feeCents: number;
  netCents: number;
  /** Orders left out of the sums because a cost was not recorded. */
  incomplete: number;
  absorbedOrders: number;
  absorbedShippingCents: number;
};

export async function orderMargins(since: Date): Promise<OrderMargin[]> {
  const orders = await prisma.order.findMany({
    where: { status: { in: [...REAL_ORDERS] }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    // Named columns: nothing about the buyer is needed to do a subtraction.
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      currency: true,
      shippingCountry: true,
      totalCents: true,
      refundedCents: true,
      discountCents: true,
      shippingCents: true,
      shippingCostCents: true,
      paymentFeeCents: true,
      items: { select: { quantity: true, unitCostCents: true } },
    },
  });

  return orders.map((o) => {
    const pairs = o.items.reduce((n, i) => n + i.quantity, 0);
    const goods = o.items.some((i) => i.unitCostCents === null)
      ? null
      : o.items.reduce((sum, i) => sum + (i.unitCostCents ?? 0) * i.quantity, 0);
    const revenue = o.totalCents - o.refundedCents;
    const net =
      goods === null || o.shippingCostCents === null || o.paymentFeeCents === null
        ? null
        : revenue - goods - o.shippingCostCents - o.paymentFeeCents;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      at: o.createdAt,
      currency: o.currency.toLowerCase(),
      pairs,
      country: o.shippingCountry,
      revenueCents: revenue,
      discountCents: o.discountCents,
      goodsCents: goods,
      shippingCostCents: o.shippingCostCents,
      shippingAbsorbed: o.shippingCents === 0 && (o.shippingCostCents ?? 0) > 0,
      feeCents: o.paymentFeeCents,
      netCents: net,
    };
  });
}

/** One line per currency, never added across them. */
export function totalsByCurrency(orders: OrderMargin[]): CurrencyTotals[] {
  const map = new Map<string, CurrencyTotals>();
  for (const o of orders) {
    const t =
      map.get(o.currency) ??
      {
        currency: o.currency,
        orders: 0,
        revenueCents: 0,
        goodsCents: 0,
        shippingCostCents: 0,
        feeCents: 0,
        netCents: 0,
        incomplete: 0,
        absorbedOrders: 0,
        absorbedShippingCents: 0,
      };
    t.orders++;
    if (o.shippingAbsorbed) {
      t.absorbedOrders++;
      t.absorbedShippingCents += o.shippingCostCents ?? 0;
    }
    if (o.netCents === null) {
      t.incomplete++;
    } else {
      t.revenueCents += o.revenueCents;
      t.goodsCents += o.goodsCents ?? 0;
      t.shippingCostCents += o.shippingCostCents ?? 0;
      t.feeCents += o.feeCents ?? 0;
      t.netCents += o.netCents;
    }
    map.set(o.currency, t);
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export type PriceAlignmentRow = {
  model: string;
  /** Each market's price in US cents at the frozen rate, with its drift. */
  cells: { market: MarketKey; usdCents: number | null; deviationPercent: number | null }[];
};

/**
 * The six prices of each model, in one currency.
 *
 * The client chose them to be worth the same everywhere (USD 45.00 to 46.48 on
 * 2026-08-20). The prices are fixed and the currencies are not, so one market
 * can quietly start earning less than the others with nobody touching
 * anything. This is that check, recalculated on every visit.
 *
 * Deviation is from the model's own average across the markets it has.
 */
export async function priceAlignment(): Promise<PriceAlignmentRow[]> {
  const products = await prisma.product.findMany({
    where: { status: { in: ["LIVE", "DRAFT"] } },
    select: {
      name: true,
      marketPrices: { select: { market: true, currency: true, priceCents: true } },
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => {
    const usd = (Object.keys(MARKETS) as MarketKey[]).map((market) => {
      const row = p.marketPrices.find((m) => m.market === market);
      const rate = row ? FX.perUsd[row.currency.toUpperCase()] : undefined;
      return { market, usdCents: row && rate ? Math.round(row.priceCents / rate) : null };
    });
    const known = usd.filter((c) => c.usdCents !== null).map((c) => c.usdCents as number);
    const mean = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
    return {
      model: p.name,
      cells: usd.map((c) => ({
        ...c,
        deviationPercent:
          c.usdCents === null || mean === null ? null : ((c.usdCents - mean) / mean) * 100,
      })),
    };
  });
}

export type FxRow = {
  currency: string;
  frozen: number;
  spot: number | null;
  /** How much dearer (positive) or cheaper the dollar is now, in percent. */
  driftPercent: number | null;
};

/**
 * The frozen rates against today's, the same comparison `npm run fx:check`
 * prints. Cached for a day: the rate that matters moves over weeks, and the
 * page should not call a third party on every visit.
 *
 * Fails soft: no spot rate is "could not check", never an error page.
 */
export async function fxHealth(): Promise<{ date: string; rows: FxRow[] }> {
  const currencies = Object.keys(FX.perUsd).filter((c) => c !== "USD");
  let spot: Record<string, number> | null = null;
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${currencies.join(",")}`,
      { next: { revalidate: 86_400 } },
    );
    if (res.ok) spot = ((await res.json()) as { rates: Record<string, number> }).rates;
  } catch {
    spot = null;
  }

  return {
    date: FX.date,
    rows: currencies.map((currency) => {
      const frozen = FX.perUsd[currency];
      const now = spot?.[currency] ?? null;
      return {
        currency,
        frozen,
        spot: now,
        driftPercent: now === null ? null : ((now - frozen) / frozen) * 100,
      };
    }),
  };
}
