import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatCurrency } from "@/lib/utils";
import { MARKETS, type MarketKey } from "@/lib/markets";
import { PLACEHOLDER_IMAGE_PREFIX } from "@/lib/catalogue-source";
import { ProductStatusBadge } from "@/components/admin/badges";

// One model: its colourways, its stock, its SKUs, its prices and what is
// actually published about it.
//
// Read-only, for the reason on the list page. See that comment before adding a
// form here.

export const dynamic = "force-dynamic";

export default async function AdminProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdminPage();

  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      variants: { orderBy: { position: "asc" } },
      marketPrices: true,
      images: { select: { id: true, url: true, type: true, variantId: true } },
    },
  });

  if (!product) notFound();

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
        The SKU the warehouse picks by has the case colour appended per order
        line — the customer chooses it at checkout, so it is not a colourway.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Price by market
          </h2>
          <dl className="mt-3 text-sm">
            {(Object.keys(MARKETS) as MarketKey[]).map((market) => {
              const row = priceFor(market);
              return (
                <div
                  key={market}
                  className="flex items-baseline justify-between py-1.5"
                >
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
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-3 text-xs text-neutral-500">
            Fixed figures chosen per market, never a daily conversion of the
            euro price.
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
