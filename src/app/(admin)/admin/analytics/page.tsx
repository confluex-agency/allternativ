import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatCurrency } from "@/lib/utils";
import { buildReport, isWindow, WINDOWS, type WindowDays } from "@/lib/analytics-report";

// Section 29. Every admin role may read it; the rules about what it may show
// are in `analytics-report.ts` and they are the reason it has no customer in it.
//
// The table that answers the founders' own question — "así ven qué lentes se
// venden más" — is the colourway one: pairs that MOVED, next to what is left.
// A stock figure alone cannot answer it (CLAUDE.md, "shoppers never see the
// stock number").

export const dynamic = "force-dynamic";

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-xs text-neutral-400">{note}</p>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {note && <p className="mt-1 max-w-3xl text-xs text-neutral-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed bg-white p-5 text-sm text-neutral-500">{children}</p>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireAdminPage();

  const { days: daysParam } = await searchParams;
  const asked = Number(daysParam);
  const days: WindowDays = isWindow(asked) ? asked : 30;
  const r = await buildReport(days);

  const funnelSteps = [
    { label: "Viewed a model", n: r.funnel.productViews },
    { label: "Added to bag", n: r.funnel.addedToBag },
    { label: "Went to checkout", n: r.funnel.checkoutStarted },
  ];

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-neutral-500">
            Last {days} days, since {r.since.toISOString().slice(0, 10)}.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`/admin/analytics?days=${w}`}
              className={`rounded-full border px-3 py-1 ${
                w === days ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"
              }`}
            >
              {w} days
            </Link>
          ))}
        </div>
      </div>

      <Section title="Sales">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Orders" value={String(r.orders)} note="paid, not cancelled or refunded" />
          <Stat label="Pairs sold" value={String(r.pairs)} />
          <Stat
            label="Orders with a code"
            value={String(r.ordersWithCode)}
            note={r.orders > 0 ? `${pct(r.ordersWithCode / r.orders)} of orders` : undefined}
          />
        </div>
        {r.revenue.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Currency</th>
                  <th className="px-4 py-3 text-right font-medium">Orders</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue, net of refunds</th>
                  <th className="px-4 py-3 text-right font-medium">Average order</th>
                  <th className="px-4 py-3 text-right font-medium">Given in discounts</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.revenue.map((row) => (
                  <tr key={row.currency}>
                    <td className="px-4 py-3 font-medium">{row.currency.toUpperCase()}</td>
                    <td className="px-4 py-3 text-right">{row.orders}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.netCents, row.currency)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.averageCents, row.currency)}</td>
                    <td className="px-4 py-3 text-right text-neutral-500">
                      {formatCurrency(row.discountCents, row.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          One line per currency, never added together: the six markets are charged in their own
          money.
        </p>
      </Section>

      <Section
        title="What sells"
        note="Pairs sold in this period next to what is left. Sell-through is sold ÷ (sold + left). Sold-out views count consenting visitors who opened a colourway while it had run out: a floor, and the signal for what to reorder."
      >
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Colour</th>
                <th className="px-4 py-3 text-right font-medium">Sold</th>
                <th className="px-4 py-3 text-right font-medium">Left</th>
                <th className="px-4 py-3 text-right font-medium">Sell-through</th>
                <th className="px-4 py-3 text-right font-medium">Sold-out views</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {r.colourways.map((c) => (
                <tr key={c.sku}>
                  <td className="px-4 py-3">{c.model}</td>
                  <td className="px-4 py-3">
                    {c.colour}
                    <span className="block font-mono text-[11px] text-neutral-400">{c.sku}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{c.sold}</td>
                  <td className={`px-4 py-3 text-right ${c.inStock <= 0 ? "text-red-600" : ""}`}>
                    {c.inStock}
                  </td>
                  <td className="px-4 py-3 text-right">{pct(c.sellThrough)}</td>
                  <td className="px-4 py-3 text-right text-neutral-500">{c.soldOutViews || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Where orders went">
        {r.byCountry.length === 0 ? (
          <Empty>No orders in this period.</Empty>
        ) : (
          <div className="flex flex-wrap gap-2 text-sm">
            {r.byCountry.map((c) => (
              <span key={c.country} className="rounded-md border bg-white px-3 py-1.5">
                {c.country} <span className="ml-1 font-semibold">{c.orders}</span>
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Visits"
        note="Only visitors who accepted analytics cookies are counted, so every figure below is a floor. Orders above count everybody, which is why the two are never divided into a single conversion rate."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Sessions" value={String(r.traffic.sessions)} />
          <Stat label="Visitors" value={String(r.traffic.visitors)} />
          <Stat label="Page views" value={String(r.traffic.pageViews)} />
          <Stat label="Left after one page" value={pct(r.traffic.bounce)} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Funnel</p>
            <ol className="mt-3 space-y-2">
              {funnelSteps.map((step, i) => (
                <li key={step.label} className="flex items-baseline justify-between">
                  <span>{step.label}</span>
                  <span>
                    <span className="font-semibold">{step.n}</span>
                    {i > 0 && funnelSteps[i - 1].n > 0 && (
                      <span className="ml-2 text-xs text-neutral-400">
                        {pct(step.n / funnelSteps[i - 1].n)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
              <li className="flex items-baseline justify-between border-t pt-2 text-neutral-500">
                <span>Paid (all buyers)</span>
                <span className="font-semibold">{r.orders}</span>
              </li>
            </ol>
          </div>

          <div className="rounded-lg border bg-white p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Where visits came from</p>
            {r.sources.length === 0 ? (
              <p className="mt-3 text-neutral-400">No visits recorded.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {r.sources.map((s) => (
                  <li key={s.source} className="flex justify-between gap-4">
                    <span className="truncate">{s.source}</span>
                    <span className="font-semibold">{s.sessions}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Most viewed pages</p>
            {r.topPages.length === 0 ? (
              <p className="mt-3 text-neutral-400">No page views recorded.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {r.topPages.map((p) => (
                  <li key={p.path} className="flex justify-between gap-4">
                    <span className="truncate font-mono text-xs">{p.path}</span>
                    <span className="font-semibold">{p.views}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {r.searches.length > 0 && (
          <div className="mt-4 rounded-lg border bg-white p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Searched for</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.searches.map((s) => (
                <span key={s.term} className="rounded-md bg-neutral-100 px-2 py-1">
                  {s.term} <span className="text-neutral-500">×{s.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
