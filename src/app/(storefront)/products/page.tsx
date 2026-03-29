import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "All Products",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const typeFilter = params.type;
  const categoryFilter = params.category;

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(typeFilter ? { type: typeFilter as never } : {}),
      ...(categoryFilter
        ? { categories: { some: { category: { slug: categoryFilter } } } }
        : {}),
    },
    include: { images: { where: { isPrimary: true }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-light tracking-tight">
        {typeFilter || categoryFilter || "All Products"}
      </h1>

      {/* TODO: Filters sidebar */}

      <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="group"
          >
            <div className="aspect-square bg-neutral-100 mb-4" />
            <h3 className="text-sm font-medium">{product.name}</h3>
            <p className="mt-1 text-sm text-neutral-500">
              {formatCurrency(product.priceCents)}
            </p>
          </Link>
        ))}
        {products.length === 0 && (
          <p className="col-span-full text-neutral-500 py-12 text-center">
            No products found.
          </p>
        )}
      </div>
    </div>
  );
}
