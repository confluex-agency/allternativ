import Link from "next/link";
import {
  mockProducts,
  tintToClass,
  formatMockPrice,
  type MockProduct,
} from "@/lib/mock-data";

export const metadata = {
  title: "All Eyewear",
};

const TYPE_LABEL: Record<MockProduct["type"], string> = {
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
  const categoryFilter = params.category;

  const filtered = mockProducts.filter((p) => {
    if (typeFilter && p.type !== typeFilter) return false;
    if (categoryFilter && p.type.toLowerCase() !== categoryFilter.replace("-", "_"))
      return false;
    return true;
  });

  const title = typeFilter
    ? TYPE_LABEL[typeFilter as MockProduct["type"]] ?? "All Eyewear"
    : categoryFilter
    ? categoryFilter.replace("-", " ")
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
          Catalogue placeholder. Real pieces load once the production team
          delivers the photoshoot.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2 md:mb-10">
        {(["SUNGLASSES", "OPTICAL", "BLUE_LIGHT", "READING"] as const).map(
          (type) => {
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
                {TYPE_LABEL[type]}
              </Link>
            );
          },
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-24 text-center text-brand-muted">
          No pieces in this collection yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="group block"
            >
              <div
                className={`relative aspect-square overflow-hidden rounded-[1.25rem] fluid-transition group-hover:-translate-y-1 md:rounded-[1.5rem] ${tintToClass[product.tint]}`}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 fluid-transition"
                  style={{
                    background:
                      "radial-gradient(at 50% 40%, rgba(255,255,255,0.55), transparent 70%)",
                    mixBlendMode: "screen",
                  }}
                />
                <div className="absolute inset-0 grid place-items-center">
                  <span className="eyebrow text-[10px] md:text-xs text-brand-ink/25">
                    placeholder
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-start justify-between gap-2 md:mt-5">
                <div className="min-w-0">
                  <h3 className="truncate text-sm md:text-base text-brand-ink">
                    {product.name}
                  </h3>
                  <p className="mt-1 truncate text-xs text-brand-muted">
                    {product.tagline}
                  </p>
                </div>
                <p className="text-xs md:text-sm text-brand-ink whitespace-nowrap">
                  {formatMockPrice(product.priceCents)}
                  {product.compareAtPriceCents && (
                    <span className="ml-1 hidden text-xs text-brand-muted line-through md:inline">
                      {formatMockPrice(product.compareAtPriceCents)}
                    </span>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
