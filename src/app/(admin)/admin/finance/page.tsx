import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { COMMERCIAL_ROLES } from "@/lib/roles";
import { formatCurrency } from "@/lib/utils";
import { MARKETS, type MarketKey } from "@/lib/markets";
import {
  DRIFT_ALERT_PERCENT,
  fxHealth,
  orderMargins,
  priceAlignment,
  totalsByCurrency,
} from "@/lib/finance-report";

// Costs and margins (section 12 of the client's answer of 2026-09-21). The
// rules are in `finance-report.ts`; the one that decides who sees it is here:
// COMMERCIAL_ROLES, because this is what the shop pays and keeps.

export const dynamic = "force-dynamic";

const WINDOWS = [30, 90, 365] as const;

function money(cents: number | null, currency: string) {
  return cents === null ? (
    <span className="text-amber-600">unknown</span>
  ) : (
    formatCurrency(cents, currency)
  );
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireAdminPage(...COMMERCIAL_ROLES);

  const { days: daysParam } = await searchParams;
  const asked = Number(daysParam);
  const days = (WINDOWS as readonly number[]).includes(asked) ? asked : 90;
  const [orders, alignment, fx] = await Promise.all([
    orderMargins(days),
    priceAlignment(),
    fxHealth(),
  ]);
  const totals = totalsByCurrency(orders);

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Costs &amp; margins</h1>
          <p className="mt-1 max-w-2xl text-neutral-500">
            What each sale left after the pairs, the parcel and the card fee. Costs are the ones
            frozen on each order when it was paid, so a later supplier price change never rewrites
            the past.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`/admin/finance?days=${w}`}
              className={`rounded-full border px-3 py-1 ${
                w === days ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"
              }`}
            >
              {w} days
            </Link>
          ))}
        </div>
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Totals, per currency
      </h2>
      {totals.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed bg-white p-5 text-sm text-neutral-500">
          No paid orders in the last {days} days.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Currency</th>
                <th className="px-4 py-3 text-right font-medium">Orders</th>
                <th className="px-4 py-3 text-right font-medium">Revenue</th>
                <th className="px-4 py-3 text-right font-medium">Pairs at cost</th>
                <th className="px-4 py-3 text-right font-medium">Parcels</th>
                <th className="px-4 py-3 text-right font-medium">Card fees</th>
                <th className="px-4 py-3 text-right font-medium">Left</th>
                <th className="px-4 py-3 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {totals.map((t) => (
                <tr key={t.currency}>
                  <td className="px-4 py-3 font-medium">{t.currency.toUpperCase()}</td>
                  <td className="px-4 py-3 text-right">
                    {t.orders}
                    {t.incomplete > 0 && (
                      <span className="block text-xs text-amber-600">
                        {t.incomplete} without costs, left out
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(t.revenueCents, t.currency)}</td>
                  <td className="px-4 py-3 text-right">−{formatCurrency(t.goodsCents, t.currency)}</td>
                  <td className="px-4 py-3 text-right">
                    −{formatCurrency(t.shippingCostCents, t.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">−{formatCurrency(t.feeCents, t.currency)}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${t.netCents < 0 ? "text-red-600" : ""}`}
                  >
                    {formatCurrency(t.netCents, t.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-500">
                    {t.revenueCents > 0 ? `${Math.round((t.netCents / t.revenueCents) * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totals.some((t) => t.absorbedOrders > 0) && (
        <div className="mt-4 rounded-lg border bg-white p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Delivery given away (2+ pairs ship free)
          </p>
          <ul className="mt-2 space-y-1">
            {totals
              .filter((t) => t.absorbedOrders > 0)
              .map((t) => (
                <li key={t.currency}>
                  {t.absorbedOrders} order{t.absorbedOrders === 1 ? "" : "s"},{" "}
                  <span className="font-semibold">
                    {formatCurrency(t.absorbedShippingCents, t.currency)}
                  </span>{" "}
                  of parcels paid by the shop
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">
            Already inside &quot;Parcels&quot; above. Shown apart because it is the price of the
            free-delivery rule, and the rule is only worth it if bigger baskets pay for it.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Order by order
          </h2>
          <div className="mt-3 overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 text-right font-medium">Pairs</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  <th className="px-4 py-3 text-right font-medium">Pairs at cost</th>
                  <th className="px-4 py-3 text-right font-medium">Parcel</th>
                  <th className="px-4 py-3 text-right font-medium">Fee</th>
                  <th className="px-4 py-3 text-right font-medium">Left</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="underline underline-offset-2">
                        {o.orderNumber}
                      </Link>
                      <span className="block text-xs text-neutral-400">
                        {o.at.toISOString().slice(0, 10)}
                        {o.discountCents > 0 &&
                          ` · code −${formatCurrency(o.discountCents, o.currency)}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">{o.country ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{o.pairs}</td>
                    <td className="px-4 py-3 text-right">{money(o.revenueCents, o.currency)}</td>
                    <td className="px-4 py-3 text-right">{money(o.goodsCents, o.currency)}</td>
                    <td className="px-4 py-3 text-right">
                      {money(o.shippingCostCents, o.currency)}
                      {o.shippingAbsorbed && (
                        <span className="block text-xs text-neutral-400">absorbed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{money(o.feeCents, o.currency)}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        o.netCents !== null && o.netCents < 0 ? "text-red-600" : ""
                      }`}
                    >
                      {money(o.netCents, o.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Are the six prices still worth the same?
      </h2>
      <p className="mt-1 max-w-3xl text-xs text-neutral-500">
        Each market&apos;s price in US dollars at the frozen rate of {fx.date}. They were set to be
        worth the same everywhere; a market more than {DRIFT_ALERT_PERCENT}% off its model&apos;s
        average is earning noticeably less (or more) than the rest.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Model</th>
              {(Object.keys(MARKETS) as MarketKey[]).map((m) => (
                <th key={m} className="px-4 py-3 text-right font-medium">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {alignment.map((row) => (
              <tr key={row.model}>
                <td className="px-4 py-3">{row.model}</td>
                {row.cells.map((c) => {
                  const off =
                    c.deviationPercent !== null &&
                    Math.abs(c.deviationPercent) > DRIFT_ALERT_PERCENT;
                  return (
                    <td key={c.market} className="px-4 py-3 text-right">
                      {c.usdCents === null ? (
                        <span className="text-amber-600">not set</span>
                      ) : (
                        <>
                          {formatCurrency(c.usdCents, "usd")}
                          <span
                            className={`block text-xs ${off ? "font-semibold text-red-600" : "text-neutral-400"}`}
                          >
                            {c.deviationPercent === null ? "" : signed(c.deviationPercent)}
                          </span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Exchange rates
      </h2>
      <p className="mt-1 max-w-3xl text-xs text-neutral-500">
        The supplier bills in dollars. Delivery and costs are converted at rates frozen on{" "}
        {fx.date}, so the delivery price does not move between the bag and the payment page. A
        positive drift means a dollar now costs more of that currency than the frozen rate assumes:
        delivery is being undercharged by about that much. Past {DRIFT_ALERT_PERCENT}% it is worth
        re-freezing the rates (a code change, in <code>src/lib/shipping.ts</code>).
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {fx.rows.map((r) => {
          const off = r.driftPercent !== null && Math.abs(r.driftPercent) > DRIFT_ALERT_PERCENT;
          return (
            <div key={r.currency} className="min-w-36 rounded-lg border bg-white px-4 py-3">
              <p className="font-medium">{r.currency}</p>
              <p className="text-xs text-neutral-500">
                frozen {r.frozen} · now {r.spot ?? "?"}
              </p>
              <p className={`mt-1 ${off ? "font-semibold text-red-600" : "text-neutral-600"}`}>
                {r.driftPercent === null ? "could not check" : signed(r.driftPercent)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
