import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let featuredProducts: Awaited<
    ReturnType<typeof prisma.product.findMany>
  > = [];
  let categories: Awaited<ReturnType<typeof prisma.category.findMany>> = [];

  try {
    featuredProducts = await prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      include: { images: { where: { isPrimary: true }, take: 1 } },
      take: 4,
    });

    categories = await prisma.category.findMany({
      take: 4,
      orderBy: { name: "asc" },
    });
  } catch {
    // DB not connected — render page with empty data
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-neutral-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-32 lg:py-48">
          <h1 className="text-5xl font-light tracking-tight lg:text-7xl">
            See differently.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-neutral-400">
            Premium eyewear crafted for those who appreciate quality, design,
            and individuality.
          </p>
          <div className="mt-10 flex gap-4">
            <Link
              href="/products"
              className="bg-white text-black px-8 py-3 text-sm font-medium tracking-wide hover:bg-neutral-200 transition-colors"
            >
              SHOP ALL
            </Link>
            <Link
              href="/products?type=SUNGLASSES"
              className="border border-white px-8 py-3 text-sm font-medium tracking-wide hover:bg-white hover:text-black transition-colors"
            >
              SUNGLASSES
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-2xl font-light tracking-tight">Collections</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="group relative aspect-square bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors"
            >
              <span className="text-lg font-medium tracking-wide">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-light tracking-tight">Featured</h2>
          <Link
            href="/products"
            className="text-sm text-neutral-500 hover:text-black transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group"
            >
              <div className="aspect-square bg-neutral-100 mb-4" />
              <h3 className="text-sm font-medium">{product.name}</h3>
              <p className="mt-1 text-sm text-neutral-500">
                {formatCurrency(product.priceCents)}
                {product.compareAtPriceCents && (
                  <span className="ml-2 line-through text-neutral-400">
                    {formatCurrency(product.compareAtPriceCents)}
                  </span>
                )}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
