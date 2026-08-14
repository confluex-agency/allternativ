import Link from "next/link";
import { getLiveProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/storefront/product-card";

export const metadata = {
  title: "All Eyewear",
};

const TYPE_LABEL: Record<string, string> = {
  SUNGLASSES: "Sunglasses",
  OPTICAL: "Optical",
  BLUE_LIGHT: "Blue Light",
  READING: "Reading",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const typeFilter = params.type;

  const products = await getLiveProducts();

  const filtered = typeFilter
    ? products.filter((p) => p.type === typeFilter)
    : products;

  // Derived from the catalogue, never hardcoded: a chip must not advertise a
  // collection that has no pieces. Today every silhouette is SUNGLASSES, so the
  // row hides itself — it reappears on its own when a second type ships.
  const availableTypes = [...new Set(products.map((p) => p.type))];

  const title = typeFilter
    ? (TYPE_LABEL[typeFilter] ?? "All Eyewear")
    : "All Eyewear";

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-6 md:py-20 lg:px-12 lg:py-32">
      <div className="mb-10 flex flex-col gap-5 md:mb-16 md:gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow text-brand-muted mb-3 md:mb-4">catalogue</p>
          <h1 className="display text-[clamp(2.25rem,8vw,5rem)] text-brand-ink capitalize">
            {title}
          </h1>
        </div>
        <p className="max-w-xs text-sm text-brand-ink-soft">
          The Frequency collection, shot from every angle.
        </p>
      </div>

      {availableTypes.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2 md:mb-10">
          {availableTypes.map((type) => {
            const active = typeFilter === type;
            return (
              <Link
                key={type}
                href={`/products${active ? "" : `?type=${type}`}`}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 py-2 eyebrow fluid-transition ${
                  active
                    ? "border-brand-ink bg-brand-ink text-brand-beige"
                    : "border-brand-ink/15 text-brand-ink-soft hover:border-brand-ink hover:text-brand-ink"
                }`}
              >
                {TYPE_LABEL[type] ?? type}
              </Link>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-24 text-center text-brand-muted">
          No pieces in this collection yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
