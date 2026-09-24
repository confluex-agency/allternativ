// Everything the Analytics screen shows, for one window of days (section 29).
//
// The four `/api/analytics/*` routes were built and role-checked in August and
// nothing ever rendered them. This is the screen, reading the database
// directly from a server component the way the dashboard does, so there is no
// client fetch to guard twice.
//
// ⚠️ Every admin role reaches it, ANALYTICS_VIEWER included, so NOTHING here is
// customer-identifying: counts, sums, SKUs, countries. No names, no emails, no
// addresses. Same rule as the dashboard and `/api/analytics/*`.
//
// ⚠️ Two sources that do not measure the same people, and the screen says so:
//
//   * ORDERS are every sale — Stripe tells us about all of them.
//   * VISITS and events count only visitors who ACCEPTED analytics cookies
//     (`consent.ts`). They are a floor, never a total.
//
// So "orders ÷ sessions" can exceed what is true, and on a quiet week can even
// pass 100%. It is shown as a ratio of two named figures, never as a bare
// "conversion rate" that invites being quoted.
//
// ⚠️ Money is grouped by currency and never summed across them, for the reason
// the dashboard gives. `daily_analytics.total_revenue_cents` DOES sum them,
// which is why this screen does not read that column.
//
// Events are kept 90 days (`cleanup-events.ts`), which is why the longest
// window offered is 90.

import { prisma } from "@/lib/prisma";

export const WINDOWS = [7, 30, 90] as const;
export type WindowDays = (typeof WINDOWS)[number];

export function isWindow(value: number): value is WindowDays {
  return (WINDOWS as readonly number[]).includes(value);
}

/** Paid and not undone. The same list the dashboard counts. */
const REAL_ORDERS = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export type ColourwayRow = {
  sku: string;
  model: string;
  colour: string;
  sold: number;
  inStock: number;
  /** Sold ÷ (sold + left), 0–1. Null when neither is known. */
  sellThrough: number | null;
  /** Consenting visitors who opened this colourway while it was sold out. */
  soldOutViews: number;
};

export type Report = {
  days: WindowDays;
  since: Date;
  orders: number;
  pairs: number;
  revenue: {
    currency: string;
    orders: number;
    netCents: number;
    discountCents: number;
    averageCents: number;
  }[];
  ordersWithCode: number;
  byCountry: { country: string; orders: number }[];
  colourways: ColourwayRow[];
  traffic: {
    sessions: number;
    visitors: number;
    pageViews: number;
    /** Share of sessions that saw one page. 0–1, null with no sessions. */
    bounce: number | null;
  };
  funnel: {
    productViews: number;
    addedToBag: number;
    checkoutStarted: number;
  };
  sources: { source: string; sessions: number }[];
  topPages: { path: string; views: number }[];
  searches: { term: string; count: number }[];
};

function count<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (k) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * Where a session came from, said the way a person would.
 *
 * UTM first, because a campaign link says so on purpose. A referrer is reduced
 * to its host: the full URL of somebody's Instagram story is noise.
 */
function sourceOf(s: { utmSource: string | null; referrer: string | null }) {
  if (s.utmSource) return s.utmSource.toLowerCase();
  if (!s.referrer) return "direct";
  try {
    return new URL(s.referrer).hostname.replace(/^www\./, "");
  } catch {
    return "other";
  }
}

export async function buildReport(days: WindowDays): Promise<Report> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const realOrder = { status: { in: [...REAL_ORDERS] }, createdAt: { gte: since } };

  const [
    byCurrency,
    orderRows,
    items,
    variants,
    sessions,
    pageViews,
    funnelCounts,
    soldOut,
    topPages,
    searchEvents,
  ] = await Promise.all([
    prisma.order.groupBy({
      by: ["currency"],
      where: realOrder,
      _count: true,
      _sum: { totalCents: true, refundedCents: true, discountCents: true },
      orderBy: { currency: "asc" },
    }),
    prisma.order.findMany({
      where: realOrder,
      select: { shippingCountry: true, discountCents: true },
    }),
    prisma.orderItem.groupBy({
      by: ["variantId"],
      where: { order: realOrder },
      _sum: { quantity: true },
    }),
    prisma.productVariant.findMany({
      where: { product: { status: { not: "DISCONTINUED" } } },
      select: {
        id: true,
        sku: true,
        colorName: true,
        stockQuantity: true,
        product: { select: { name: true } },
      },
      orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
    }),
    prisma.session.findMany({
      where: { landedAt: { gte: since } },
      select: {
        visitorId: true,
        pageCount: true,
        utmSource: true,
        referrer: true,
      },
    }),
    prisma.trackingEvent.count({
      where: { eventType: "page_view", timestamp: { gte: since } },
    }),
    prisma.trackingEvent.groupBy({
      by: ["eventType"],
      where: {
        eventType: { in: ["product_view", "add_to_cart", "checkout_start"] },
        timestamp: { gte: since },
      },
      _count: true,
    }),
    prisma.trackingEvent.findMany({
      where: { eventType: "sold_out_view", timestamp: { gte: since } },
      select: { metadata: true },
    }),
    prisma.trackingEvent.groupBy({
      by: ["pagePath"],
      where: { eventType: "page_view", timestamp: { gte: since } },
      _count: true,
      orderBy: { _count: { pagePath: "desc" } },
      take: 10,
    }),
    prisma.trackingEvent.findMany({
      where: { eventType: "search", timestamp: { gte: since } },
      select: { metadata: true },
    }),
  ]);

  const sold = new Map(items.map((i) => [i.variantId, i._sum.quantity ?? 0]));
  const soldOutBySku = new Map(
    count(soldOut, (e) => {
      const sku = (e.metadata as Record<string, unknown> | null)?.sku;
      return typeof sku === "string" ? sku : null;
    }),
  );

  const colourways: ColourwayRow[] = variants
    .map((v) => {
      const n = sold.get(v.id) ?? 0;
      const left = Math.max(0, v.stockQuantity);
      return {
        sku: v.sku,
        model: v.product.name,
        colour: v.colorName,
        sold: n,
        inStock: v.stockQuantity,
        sellThrough: n + left > 0 ? n / (n + left) : null,
        soldOutViews: soldOutBySku.get(v.sku) ?? 0,
      };
    })
    // Best sellers first; the ones that have not moved keep the catalogue order.
    .sort((a, b) => b.sold - a.sold);

  const funnel = Object.fromEntries(
    funnelCounts.map((f) => [f.eventType, f._count]),
  ) as Record<string, number>;

  const revenue = byCurrency.map((row) => {
    const net = (row._sum.totalCents ?? 0) - (row._sum.refundedCents ?? 0);
    return {
      currency: row.currency,
      orders: row._count,
      netCents: net,
      discountCents: row._sum.discountCents ?? 0,
      averageCents: row._count > 0 ? Math.round(net / row._count) : 0,
    };
  });

  return {
    days,
    since,
    orders: orderRows.length,
    pairs: [...sold.values()].reduce((a, b) => a + b, 0),
    revenue,
    ordersWithCode: orderRows.filter((o) => o.discountCents > 0).length,
    byCountry: count(orderRows, (o) => o.shippingCountry).map(([country, orders]) => ({
      country,
      orders,
    })),
    colourways,
    traffic: {
      sessions: sessions.length,
      visitors: new Set(sessions.map((s) => s.visitorId)).size,
      pageViews,
      bounce:
        sessions.length > 0
          ? sessions.filter((s) => s.pageCount <= 1).length / sessions.length
          : null,
    },
    funnel: {
      productViews: funnel.product_view ?? 0,
      addedToBag: funnel.add_to_cart ?? 0,
      checkoutStarted: funnel.checkout_start ?? 0,
    },
    sources: count(sessions, sourceOf)
      .slice(0, 8)
      .map(([source, n]) => ({ source, sessions: n })),
    topPages: topPages.map((p) => ({ path: p.pagePath ?? "—", views: p._count })),
    searches: count(searchEvents, (e) => {
      const q = (e.metadata as Record<string, unknown> | null)?.query;
      return typeof q === "string" && q.trim() ? q.trim().toLowerCase() : null;
    })
      .slice(0, 10)
      .map(([term, n]) => ({ term, count: n })),
  };
}
