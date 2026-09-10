import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-guard";
import { formatCurrency } from "@/lib/utils";
import { ProductStatusBadge } from "@/components/admin/badges";

// The catalogue, as the people who own it need to see it.
//
// ⚠️ Read-only for now, and that is a decision rather than a stage. Editing the
// catalogue from here needs `prisma/seed.ts` to stop replaying
// `catalogue-source.ts` over the database first — today a re-seed refreshes
// every product's copy, so anything typed here would be silently overwritten
// the next time somebody ran the seed. Shipping an edit form before that change
// would be shipping a form that loses work.
//
// What this screen is for is the question actually asked on launch day: what is
// live, what is a draft, and how many pairs are left.
//
// Any signed-in admin may read it. It carries no customer data and no cost —
// `supplier_cost_usd_cents` is deliberately not selected, because ANALYTICS_VIEWER
// can open this page and section 18 never said finance was part of that role.

export const dynamic = "force-dynamic";

const STOCK_LOW = 10;

export default async function AdminProductsPage() {
  await requireAdminPage();

  const products = await prisma.product.findMany({
    where: { status: { not: "DISCONTINUED" } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      status: true,
      priceCents: true,
      variants: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        select: { id: true, stockQuantity: true },
      },
    },
  });

  const totalPairs = products.reduce(
    (n, p) => n + p.variants.reduce((m, v) => m + v.stockQuantity, 0),
    0,
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Products</h1>
      <p className="mt-1 text-neutral-500">
        {products.length} models · {totalPairs} pairs in stock
      </p>

      <div className="mt-8 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Colourways</th>
              <th className="px-4 py-3 text-right font-medium">In stock</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((product) => {
              const stock = product.variants.reduce(
                (n, v) => n + v.stockQuantity,
                0,
              );
              // Negative is not "low", it is the shop owing more than it holds,
              // and it means every further sale of that colourway is refused
              // until a person intervenes. It gets its own colour.
              const anyNegative = product.variants.some(
                (v) => v.stockQuantity < 0,
              );
              return (
                <tr key={product.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${product.slug}`}
                      className="font-medium underline underline-offset-2"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                    {product.code}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {product.variants.length}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      anyNegative
                        ? "text-red-600"
                        : stock <= STOCK_LOW
                          ? "text-amber-600"
                          : ""
                    }`}
                  >
                    {stock}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatCurrency(product.priceCents, "eur")}
                  </td>
                  <td className="px-4 py-3">
                    <ProductStatusBadge status={product.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-2xl text-xs text-neutral-500">
        Read-only. Editing the catalogue from here is not wired up yet: the seed
        still replays <code>catalogue-source.ts</code> over the database, so
        anything typed here would be overwritten the next time it ran.
      </p>
    </div>
  );
}
