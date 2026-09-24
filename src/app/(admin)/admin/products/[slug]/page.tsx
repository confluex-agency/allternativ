import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatCurrency } from "@/lib/utils";
import { MARKETS, type MarketKey } from "@/lib/markets";
import { PLACEHOLDER_IMAGE_PREFIX } from "@/lib/catalogue-source";
import { ProductStatusBadge } from "@/components/admin/badges";
import { StockControl } from "@/components/admin/stock-control";
import { PriceControl } from "@/components/admin/price-control";
import { worstCaseNet, type WorstCase } from "@/lib/prices-admin";
import { COMMERCIAL_ROLES, hasRole } from "@/lib/roles";

// One model: its colourways, its stock, its SKUs, its prices and what is
// actually published about it.
//
// ⚠️ **Stock is editable here since 2026-09-13 and the market prices since
// 2026-09-24 (C5); everything else on this page is still read-only, and the
// line between them is not arbitrary.**
//
// Stock was never blocked. The claim that the whole screen was waiting on
// `prisma/seed.ts` turned out to be true of the COPY and of `priceCents` — the
// seed replays `catalogue-source.ts` over those on every run — and false of
// stock, which the seed writes on create only and never refreshes, precisely so
// that re-seeding a shop that has sold something cannot put the sold units back
// on the shelf. `market_prices` is already safe too: its upsert uses
// `update: {}` with a comment saying it is so a price edit is not silently
// temporary.
//
// So what still needs the seed to change before it can be edited is the product
// copy and `Product.priceCents`. Adding a form for either before that is
// shipping a form that loses work.

export const dynamic = "force-dynamic";

export default async function AdminProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireAdminPage();
  // Stock is money, so the route that writes it is behind COMMERCIAL_ROLES.
  // Asked once, here, from the same shared list the route uses.
  const canEditStock = hasRole(user.role, COMMERCIAL_ROLES);

  const { slug } = await params;
  // ⚠️ `select`, never `include`, and the list page carries the same rule with
  // the same comment.
  //
  // `include` does not mean "and also these relations" — it means "every
  // scalar column of this model, AND these relations". So the obvious-looking
  // `include: { variants, marketPrices, images }` was fetching the whole
  // `Product` row, **`supplierCostUsdCents` with it**: what Allternativ pays
  // the supplier per pair, on a page `requireAdminPage()` opens for ANY signed
  // -in admin, ANALYTICS_VIEWER and CONTENT_ADMIN included. Section 18 never
  // said finance was part of either role.
  //
  // Nothing rendered it, so nothing leaked. That is exactly why it was worth
  // changing: in the App Router, anything handed to a `"use client"` component
  // is serialised into the HTML that ships to the browser, where it sits in
  // view-source. The distance between here and a real leak was one ordinary
  // edit — making the spec table collapsible, or a `JSON.stringify(product)`
  // left in from an afternoon's debugging — and NOTHING would have failed. No
  // test, no type error, an identical-looking page.
  //
  // Named columns fail the other way round: ask for a field that is not on
  // this list and the build says so. `/api/analytics/sales` is explicit for
  // the same reason, after a bare `findMany` there returned whole Order rows
  // with the shipping address in them.
  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      name: true,
      code: true,
      tagline: true,
      status: true,
      priceCents: true,
      // The published specification, exactly the eight rows below.
      frameDetail: true,
      lensMaterial: true,
      uvProtection: true,
      lensCategory: true,
      dimensionsMm: true,
      weightGrams: true,
      fit: true,
      origin: true,
      variants: {
        orderBy: { position: "asc" },
        // `supplierSku` is left out on the same principle: it is the code the
        // supplier's ERP maps against, this screen never shows it, and a
        // column nobody asked for is a column nobody checked.
        select: {
          id: true,
          swatch: true,
          colorName: true,
          sku: true,
          stockQuantity: true,
          isActive: true,
        },
      },
      marketPrices: { select: { market: true, currency: true, priceCents: true } },
      images: { select: { id: true, url: true, type: true, variantId: true } },
    },
  });

  if (!product) notFound();

  // What the worst order in each market would leave, for the people who may
  // change the price. The cost is read in its own query and only for them:
  // the select above is shared by every role and must stay free of it.
  let worstByMarket: Partial<Record<MarketKey, WorstCase | null>> = {};
  if (canEditStock) {
    const cost = await prisma.product.findUnique({
      where: { slug },
      select: { supplierCostUsdCents: true },
    });
    worstByMarket = Object.fromEntries(
      (Object.keys(MARKETS) as MarketKey[]).map((market) => {
        const row = product.marketPrices.find((p) => p.market === market);
        return [
          market,
          worstCaseNet(
            cost?.supplierCostUsdCents ?? null,
            market,
            row?.priceCents ?? product.priceCents,
          ),
        ];
      }),
    );
  }

  const priceFor = (market: MarketKey) =>
    product.marketPrices.find((p) => p.market === market);

  // Every published spec, with the ones still empty shown as empty. A missing
  // row would hide the fact that it is missing, and what is NOT published is
  // the thing this catalogue is most careful about.
  const specs: [string, string | null][] = [
    ["Frame", product.frameDetail],
    ["Lens material", product.lensMaterial],
    ["UV protection", product.uvProtection],
    [
      "Filter category",
      product.lensCategory === null ? null : String(product.lensCategory),
    ],
    ["Dimensions (mm)", product.dimensionsMm],
    [
      "Weight",
      product.weightGrams === null ? null : `${Number(product.weightGrams)} g`,
    ],
    ["Fit", product.fit],
    ["Origin", product.origin],
  ];

  const placeholders = product.images.filter((i) =>
    i.url.startsWith(PLACEHOLDER_IMAGE_PREFIX),
  ).length;

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/products"
        className="text-sm text-neutral-500 underline underline-offset-2"
      >
        ← Products
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <ProductStatusBadge status={product.status} />
      </div>
      <p className="mt-1 text-neutral-500">
        <span className="font-mono text-xs">{product.code}</span> ·{" "}
        {product.tagline}
      </p>

      {product.status === "DRAFT" && (
        <p className="mt-4 rounded-md border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This model is a draft: its codes and stock are recorded, but it has no
          page and no card in the shop. Nobody can buy it.
        </p>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Colourways
      </h2>
      <div className="mt-3 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Colour</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 text-right font-medium">In stock</th>
              <th className="px-4 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {product.variants.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    {v.swatch && (
                      <span
                        aria-hidden="true"
                        className="inline-block h-3 w-3 rounded-full border"
                        style={{ backgroundColor: v.swatch }}
                      />
                    )}
                    {v.colorName}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{v.sku}</td>
                <td
                  className={`px-4 py-3 text-right font-medium ${
                    v.stockQuantity < 0
                      ? "text-red-600"
                      : v.stockQuantity === 0
                        ? "text-amber-600"
                        : ""
                  }`}
                >
                  {v.stockQuantity}
                  {v.stockQuantity === 0 && (
                    <span className="ml-2 text-xs font-normal text-amber-600">
                      sold out
                    </span>
                  )}
                  {v.stockQuantity < 0 && (
                    <span className="ml-2 text-xs font-normal text-red-600">
                      oversold — needs a person
                    </span>
                  )}
                  {/* ⚠️ Offered only to the roles that may actually save.
                      This page is readable by ANY signed-in admin — it carries
                      no customer data and no cost — but stock is money, so the
                      API route is behind COMMERCIAL_ROLES. Rendering the
                      control for a CONTENT_ADMIN would hand them a form that
                      403s, which reads as a broken admin rather than as a
                      permission they do not have.

                      The route stays the enforcement; this only decides what is
                      offered. Same split the sidebar already uses, and the same
                      shared list, so the two cannot drift into disagreeing. */}
                  {canEditStock && (
                    <StockControl
                      variantId={v.id}
                      sku={v.sku}
                      quantity={v.stockQuantity}
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {v.isActive ? "Yes" : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        The SKU the warehouse picks by has the colourway&apos;s case colour
        appended (Daniel&apos;s format, Model_Colour_Case).
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Price by market
          </h2>
          <dl className="mt-3 text-sm">
            {(Object.keys(MARKETS) as MarketKey[]).map((market) => {
              const row = priceFor(market);
              const worst = worstByMarket[market];
              return (
                <div key={market} className="py-1.5">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-neutral-500">{MARKETS[market].label}</dt>
                    <dd>
                      {row ? (
                        formatCurrency(row.priceCents, row.currency)
                      ) : (
                        // Falls back to the base price rather than failing, but
                        // that is a gap worth seeing: it means this market was
                        // never given a chosen figure.
                        <span className="text-amber-600">
                          not set — falls back to{" "}
                          {formatCurrency(product.priceCents, "eur")}
                        </span>
                      )}
                      {canEditStock && (
                        <PriceControl
                          slug={slug}
                          market={market}
                          marketLabel={MARKETS[market].label}
                          currency={MARKETS[market].currency}
                          priceCents={row?.priceCents ?? null}
                        />
                      )}
                    </dd>
                  </div>
                  {worst && (
                    <p
                      className={`text-right text-xs ${
                        worst.netCents < 0 ? "text-red-600" : "text-neutral-400"
                      }`}
                    >
                      worst order leaves{" "}
                      {formatCurrency(worst.netCents, MARKETS[market].currency)}{" "}
                      ({worst.pairs} to {worst.country})
                    </p>
                  )}
                </div>
              );
            })}
          </dl>
          <p className="mt-3 text-xs text-neutral-500">
            Fixed figures chosen per market, never a daily conversion of the
            euro price. A change reaches the shop within seconds, and a price
            that would make any order lose money is refused.
          </p>
        </section>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Published specification
          </h2>
          <dl className="mt-3 text-sm">
            {specs.map(([labelText, value]) => (
              <div
                key={labelText}
                className="flex items-baseline justify-between gap-6 py-1.5"
              >
                <dt className="text-neutral-500">{labelText}</dt>
                <dd className={value ? "" : "text-neutral-300"}>
                  {value ?? "not published"}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-neutral-500">
            Anything unpublished is simply not shown on the product page. Only
            values confirmed by the supplier are filled in.
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-lg border bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Images
        </h2>
        <p className="mt-2 text-sm">
          {product.images.length} image
          {product.images.length === 1 ? "" : "s"}
          {placeholders > 0 && (
            <span className="text-amber-600">
              {" "}
              — {placeholders} still stand-in, not photographs of this model
            </span>
          )}
        </p>
      </section>
    </div>
  );
}
