import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { formatCurrency } from "@/lib/utils";

// Server component on purpose. The guard runs before anything renders, and it
// goes through the same check the API routes use, so a token that was killed by
// a password change cannot open this page either.
//
// ⚠️ Any signed-in admin reaches this screen, ANALYTICS_VIEWER included, so
// nothing here may be customer-identifying — the same rule `/api/analytics/*`
// lives under. Counts and sums only: no names, no addresses, no emails. Money
// is fine; section 18 gives ANALYTICS_VIEWER dashboards and reports, and that
// is what these are.

export const dynamic = "force-dynamic";

/** What counts as an order that happened. A PENDING one was never paid for. */
const REAL_ORDERS = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default async function AdminDashboardPage() {
  const user = await requireAdminPage();

  const [revenueByCurrency, orderCount, awaitingDispatch, lowStock] =
    await Promise.all([
      // ⚠️ Grouped by currency, and NOT summed into one figure.
      //
      // Orders are charged in the currency of the market they were sold to —
      // the shop prices separately in EUR, GBP, USD, CAD, AUD and NZD. Adding
      // `total_cents` across them would produce a number with no unit, which is
      // the kind of figure that reads fine on a dashboard and is wrong
      // everywhere it gets repeated. Until somebody chooses a conversion policy
      // and a rate to freeze it at, the honest answer is one line per currency.
      prisma.order.groupBy({
        by: ["currency"],
        where: { status: { in: [...REAL_ORDERS] } },
        _sum: { totalCents: true, refundedCents: true },
        orderBy: { currency: "asc" },
      }),
      prisma.order.count({ where: { status: { in: [...REAL_ORDERS] } } }),
      // Paid and not yet gone. This is the pile that has to reach the supplier,
      // so it is the one number on this screen that is a to-do list.
      prisma.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
      prisma.productVariant.findMany({
        where: {
          isActive: true,
          stockQuantity: { lte: LOW_STOCK_THRESHOLD },
          product: { status: { not: "DISCONTINUED" } },
        },
        select: { sku: true, stockQuantity: true },
        orderBy: { stockQuantity: "asc" },
      }),
    ]);

  const oversold = lowStock.filter((v) => v.stockQuantity < 0);
  const soldOut = lowStock.filter((v) => v.stockQuantity === 0);
  const running = lowStock.filter((v) => v.stockQuantity > 0);

  const revenue = revenueByCurrency.map((row) => ({
    currency: row.currency,
    // Net of refunds. A refunded order is not revenue, and a dashboard that
    // counts it is a dashboard somebody reconciles against Stripe once and
    // never trusts again.
    cents: (row._sum.totalCents ?? 0) - (row._sum.refundedCents ?? 0),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-neutral-500">Welcome back, {user.name}.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenue.length === 0 ? (
              <div className="text-2xl font-semibold text-neutral-300">—</div>
            ) : (
              <div className="space-y-0.5">
                {revenue.map((r) => (
                  <div key={r.currency} className="text-2xl font-semibold">
                    {formatCurrency(r.cents, r.currency)}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-neutral-400">
              Paid orders, net of refunds
              {revenue.length > 1 ? ", per currency" : ""}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">
              Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{orderCount}</div>
            <p className="mt-1 text-xs text-neutral-400">
              Paid or beyond. Abandoned checkouts are not counted.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">
              Awaiting dispatch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold ${awaitingDispatch > 0 ? "text-amber-600" : ""}`}
            >
              {awaitingDispatch}
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {awaitingDispatch > 0 ? (
                <Link href="/admin/orders" className="underline">
                  Paid, not yet shipped
                </Link>
              ) : (
                "Nothing waiting."
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">
              Stock alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold ${
                oversold.length > 0
                  ? "text-red-600"
                  : lowStock.length > 0
                    ? "text-amber-600"
                    : ""
              }`}
            >
              {lowStock.length}
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {lowStock.length === 0
                ? `Nothing at or below ${LOW_STOCK_THRESHOLD}.`
                : [
                    oversold.length > 0 ? `${oversold.length} oversold` : null,
                    soldOut.length > 0 ? `${soldOut.length} sold out` : null,
                    running.length > 0 ? `${running.length} running low` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ⚠️ Oversold is not a small version of "low". It means the shop has
          taken money for pairs it does not hold, which happens when a payment
          lands after its reservation expired. `reserveStock` refuses every
          further sale of that colourway until somebody sorts it out, so this
          never quietly gets worse — but it does need a person. The sweep shouts
          about the same thing every fifteen minutes; this is so it is visible
          without reading a cron log. */}
      {oversold.length > 0 && (
        <div className="mt-6 rounded-lg border-l-2 border-red-500 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-900">
            Sold more than we hold — needs a person today.
          </p>
          <p className="mt-1 font-mono text-xs text-red-800">
            {oversold.map((v) => `${v.sku} (${v.stockQuantity})`).join("  ·  ")}
          </p>
          <p className="mt-2 text-xs text-red-800">
            Further sales of these are already refused. Somebody owes a customer
            a pair.
          </p>
        </div>
      )}

      {running.length > 0 && (
        <div className="mt-6 rounded-lg border bg-white px-4 py-3">
          <p className="text-sm font-medium">
            Running low, {LOW_STOCK_THRESHOLD} or fewer
          </p>
          <p className="mt-1 font-mono text-xs text-neutral-600">
            {running.map((v) => `${v.sku} (${v.stockQuantity})`).join("  ·  ")}
          </p>
        </div>
      )}
    </div>
  );
}
