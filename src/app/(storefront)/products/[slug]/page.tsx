import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { GlassesViewerLazy } from "@/components/storefront/glasses-viewer-lazy";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) return { title: "Not Found" };
  return {
    title: product.metaTitle || product.name,
    description: product.metaDescription || product.description || "",
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { position: "asc" } },
      categories: { include: { category: true } },
    },
  });

  if (!product || !product.isActive) notFound();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* 3D Viewer + Gallery */}
        <div className="space-y-4">
          <GlassesViewerLazy className="aspect-square" />
          <div className="grid grid-cols-4 gap-2">
            {product.images.slice(0, 4).map((img) => (
              <div key={img.id} className="aspect-square bg-neutral-100" />
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <h1 className="text-3xl font-light tracking-tight">
            {product.name}
          </h1>
          <p className="mt-4 text-2xl">
            {formatCurrency(product.priceCents)}
            {product.compareAtPriceCents && (
              <span className="ml-3 text-lg line-through text-neutral-400">
                {formatCurrency(product.compareAtPriceCents)}
              </span>
            )}
          </p>

          {product.description && (
            <p className="mt-6 text-neutral-600 leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Specs */}
          <dl className="mt-8 space-y-3 text-sm">
            {product.type && (
              <div className="flex gap-3">
                <dt className="text-neutral-500 w-28">Type</dt>
                <dd>{product.type.replace("_", " ")}</dd>
              </div>
            )}
            {product.frameShape && (
              <div className="flex gap-3">
                <dt className="text-neutral-500 w-28">Frame Shape</dt>
                <dd>{product.frameShape.replace("_", " ")}</dd>
              </div>
            )}
            {product.frameMaterial && (
              <div className="flex gap-3">
                <dt className="text-neutral-500 w-28">Material</dt>
                <dd>{product.frameMaterial}</dd>
              </div>
            )}
            {product.frameColor && (
              <div className="flex gap-3">
                <dt className="text-neutral-500 w-28">Color</dt>
                <dd>{product.frameColor}</dd>
              </div>
            )}
            {product.lensType && (
              <div className="flex gap-3">
                <dt className="text-neutral-500 w-28">Lens</dt>
                <dd>{product.lensType}</dd>
              </div>
            )}
            {product.gender && (
              <div className="flex gap-3">
                <dt className="text-neutral-500 w-28">Gender</dt>
                <dd>{product.gender}</dd>
              </div>
            )}
          </dl>

          <div className="mt-10">
            <AddToCartButton
              productId={product.id}
              name={product.name}
              slug={product.slug}
              priceCents={product.priceCents}
              imageUrl={product.images[0]?.url || ""}
              inStock={product.stockQuantity > 0}
            />
          </div>

          {product.stockQuantity <= 5 && product.stockQuantity > 0 && (
            <p className="mt-3 text-sm text-amber-600">
              Only {product.stockQuantity} left in stock
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
