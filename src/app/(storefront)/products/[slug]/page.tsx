import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  mockProducts,
  tintToClass,
  formatMockPrice,
} from "@/lib/mock-data";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = mockProducts.find((p) => p.slug === slug);
  if (!product) return { title: "Not Found" };
  return {
    title: `${product.name} — ${product.tagline}`,
    description: `Allternativ ${product.name}. ${product.tagline}.`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = mockProducts.find((p) => p.slug === slug);
  if (!product) notFound();

  const gallery = product.gallery ?? [];
  const heroImage = gallery[0]?.src ?? "/brand/product-prism.png";

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-12 pb-28 md:px-6 md:py-20 md:pb-20 lg:px-12 lg:py-28">
      <nav className="mb-8 eyebrow text-brand-muted md:mb-14">
        <Link href="/products" className="fluid-transition hover:text-brand-ink">
          ← Back to catalogue
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        {/* Editorial gallery + 3D reveal */}
        <ProductGallery
          name={product.name}
          tintClass={tintToClass[product.tint]}
          gallery={gallery}
          has3D={product.has3D ?? false}
        />

        {/* Editorial product info — big type, lots of air */}
        <div className="lg:pt-2">
          <p className="eyebrow text-brand-muted mb-4">
            {product.type.replace("_", " ")}
            <span className="mx-2 text-brand-ink/20">/</span>
            model {product.code}
          </p>

          <h1 className="display text-[clamp(2.75rem,7vw,4.75rem)] text-brand-ink">
            {product.name}
          </h1>
          <p className="mt-3 text-base italic text-brand-ink-soft md:text-lg">
            {product.tagline}
          </p>

          <p className="mt-8 text-2xl text-brand-ink md:mt-10">
            {formatMockPrice(product.priceCents)}
            {product.compareAtPriceCents && (
              <span className="ml-3 text-base text-brand-muted line-through">
                {formatMockPrice(product.compareAtPriceCents)}
              </span>
            )}
          </p>

          <p className="mt-8 max-w-md text-sm leading-relaxed text-brand-ink-soft md:mt-10 md:text-base">
            {product.description ??
              "Lightweight acetate frame with matte finish and lenses treated with our signature iridescent filter."}
          </p>

          <div className="mt-8 max-w-md md:mt-10">
            {/* Desktop CTA — on mobile the fixed bottom bar takes over. */}
            <div className="hidden md:block">
              <AddToCartButton
                productId={product.code}
                name={product.name}
                slug={product.slug}
                priceCents={product.priceCents}
                imageUrl={heroImage}
                inStock
              />
            </div>
            {product.has3D && (
              <p className="text-xs text-brand-muted md:mt-3">
                Tip: open the <span className="text-brand-ink">3D</span> view to
                spin the frame and try every colourway.
              </p>
            )}
          </div>

          <dl className="mt-10 space-y-3 text-sm md:mt-12">
            <Spec label="Type" value={product.type.replace("_", " ")} />
            <Spec label="Frame" value={product.frame ?? "Matte Italian acetate"} />
            <Spec label="Lens" value={product.lens ?? "Mineral — iridescent filter"} />
            <Spec label="Origin" value={product.origin ?? "Handcrafted · LATAM"} />
          </dl>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-brand-ink/10 p-4 md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-brand-muted">{product.name}</p>
            <p className="text-base text-brand-ink">
              {formatMockPrice(product.priceCents)}
            </p>
          </div>
          <div className="w-40 shrink-0">
            <AddToCartButton
              productId={product.code}
              name={product.name}
              slug={product.slug}
              priceCents={product.priceCents}
              imageUrl={heroImage}
              inStock
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-brand-ink/10 pb-3 md:gap-4">
      <dt className="eyebrow w-20 shrink-0 text-brand-muted md:w-24">{label}</dt>
      <dd className="break-words text-brand-ink-soft">{value}</dd>
    </div>
  );
}
