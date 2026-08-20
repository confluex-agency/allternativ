import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProductBySlug,
  getLiveProductSlugs,
  getCaseOptions,
  galleryFor,
  type CatalogImage,
} from "@/lib/catalog";
import { ProductPurchase } from "@/components/storefront/product-purchase";

type Props = {
  params: Promise<{ slug: string }>;
};

// Same reasoning as the home page: pre-rendered for speed, refreshed on a
// timer so an edit in the admin reaches the shop without a deploy.
export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getLiveProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not Found" };
  return {
    title: product.tagline
      ? `${product.name} — ${product.tagline}`
      : product.name,
    description:
      product.description ??
      `Allternativ ${product.name}${product.tagline ? `. ${product.tagline}.` : "."}`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Sorting happens on the server so the client component receives the gallery
  // already in the order section 07 defines.
  const galleries: Record<string, CatalogImage[]> = Object.fromEntries(
    product.variants.map((v) => [v.id, galleryFor(product, v)]),
  );

  // Cases are a shared pool across every model, so their availability is read
  // once here rather than per product.
  const caseOptions = await getCaseOptions();

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-12 pb-28 md:px-6 md:py-20 md:pb-20 lg:px-12 lg:py-28">
      <nav className="mb-8 eyebrow text-brand-muted md:mb-14">
        <Link
          href="/collections"
          className="fluid-transition hover:text-brand-ink"
        >
          ← Back to catalogue
        </Link>
      </nav>

      <ProductPurchase
        product={product}
        galleries={galleries}
        caseOptions={caseOptions}
      />
    </div>
  );
}
