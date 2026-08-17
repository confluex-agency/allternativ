// The storefront's single source of catalogue data.
//
// Everything the shop renders comes from here, and it speaks ONE vocabulary:
// the database's. A product has `variants` (the buyable colourways), a variant
// has `images`, and an image has a `type`. There is deliberately no second set
// of names — `mock-data.ts` still exists, but only as the seed's input while the
// client's real catalogue is being assembled. No page should import it.

import { prisma } from "@/lib/prisma";
import type { ImageType, ProductType } from "@/generated/prisma/client";
import { CASE_COLORS, caseLabel, type CaseColor } from "@/lib/product-options";

export type CatalogImage = {
  id: string;
  url: string;
  altText: string | null;
  type: ImageType;
  isPrimary: boolean;
};

export type CatalogVariant = {
  id: string;
  sku: string;
  colorKey: string;
  colorName: string;
  swatch: string | null;
  /** Resolved price: the variant's own if it has one, otherwise the product's. */
  priceCents: number;
  stockQuantity: number;
  inStock: boolean;
  images: CatalogImage[];
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  code: string | null;
  type: ProductType;
  tagline: string | null;
  description: string | null;
  /** "The Feeling" — editorial copy, section 09 of the client brief. */
  feeling: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  isFeatured: boolean;
  /** Published specs. Anything null is simply not rendered. */
  specs: {
    frame: string | null;
    lens: string | null;
    lensMaterial: string | null;
    uvProtection: string | null;
    lensCategory: number | null;
    dimensions: string | null;
    weightGrams: number | null;
    fit: string | null;
    origin: string | null;
  };
  variants: CatalogVariant[];
};

// Gallery order defined by section 07 of the brief: the clean studio shot first,
// then the person wearing them, then the details, case and packaging.
const IMAGE_TYPE_ORDER: Record<ImageType, number> = {
  PRODUCT: 0,
  MODEL: 1,
  DETAIL: 2,
  CASE: 3,
  LIFESTYLE: 4,
  PACKAGING: 5,
};

/** Shape of the Prisma row this module maps from. Keeps the mapper honest. */
type ProductRow = Awaited<ReturnType<typeof findProducts>>[number];

function findProducts(where: Record<string, unknown>) {
  return prisma.product.findMany({
    where,
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        include: { images: { orderBy: { position: "asc" } } },
      },
      images: { orderBy: { position: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
}

function toCatalogProduct(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    code: row.code,
    type: row.type,
    tagline: row.tagline,
    description: row.description,
    feeling: row.feeling,
    priceCents: row.priceCents,
    compareAtPriceCents: row.compareAtPriceCents,
    isFeatured: row.isFeatured,
    specs: {
      frame: row.frameDetail,
      lens: row.lensType,
      lensMaterial: row.lensMaterial,
      uvProtection: row.uvProtection,
      lensCategory: row.lensCategory,
      dimensions: row.dimensionsMm,
      weightGrams: row.weightGrams,
      fit: row.fit,
      origin: row.origin,
    },
    variants: row.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      colorKey: v.colorKey,
      colorName: v.colorName,
      swatch: v.swatch,
      priceCents: v.priceCents ?? row.priceCents,
      stockQuantity: v.stockQuantity,
      inStock: v.stockQuantity > 0,
      images: v.images.map((i) => ({
        id: i.id,
        url: i.url,
        altText: i.altText,
        type: i.type,
        isPrimary: i.isPrimary,
      })),
    })),
  };
}

/** Every product the public shop may show. */
export async function getLiveProducts(): Promise<CatalogProduct[]> {
  const rows = await findProducts({ status: "LIVE" });
  return rows.map(toCatalogProduct);
}

export async function getProductBySlug(
  slug: string,
): Promise<CatalogProduct | null> {
  const rows = await findProducts({ slug, status: "LIVE" });
  return rows[0] ? toCatalogProduct(rows[0]) : null;
}

/** Slugs for generating static product pages. */
export async function getLiveProductSlugs(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { status: "LIVE" },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

/**
 * The case colours a shopper can actually pick right now.
 *
 * Cases are bought up front in a fixed quantity like the frames are, so the
 * selector has to know when a colour has run out. Offering a case that cannot
 * be packed is a sale that fails at the warehouse instead of at the checkout.
 */
export type CaseOption = {
  key: CaseColor;
  name: string;
  available: boolean;
};

export async function getCaseOptions(): Promise<CaseOption[]> {
  const rows = await prisma.caseStock.findMany({ orderBy: { key: "asc" } });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  // Driven by CASE_COLORS, not by whatever happens to be in the table, so a
  // missing row shows up as "unavailable" rather than as a silently absent
  // option that nobody notices.
  return CASE_COLORS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      name: row?.name ?? caseLabel(key),
      available: Boolean(row?.isActive && row.stockQuantity > 0),
    };
  });
}

// ─── Helpers shared by the storefront ───────────────────────────────────────

/** The variant shown before the visitor picks a colour. */
export function defaultVariant(product: CatalogProduct): CatalogVariant | null {
  return product.variants[0] ?? null;
}

/** The one image that represents a product in a grid. */
export function heroImage(product: CatalogProduct): CatalogImage | null {
  for (const variant of product.variants) {
    const primary = variant.images.find((i) => i.isPrimary);
    if (primary) return primary;
  }
  return product.variants[0]?.images[0] ?? null;
}

/**
 * How a card should frame its image. A studio shot sits inside the card with
 * air around it; a photo of someone wearing them fills the frame instead.
 * This used to be a hand-set `photo` flag — now it follows from the image type,
 * so there is nothing to keep in sync.
 */
export function fillsFrame(image: CatalogImage | null): boolean {
  return image?.type === "MODEL" || image?.type === "LIFESTYLE";
}

/**
 * The two images a collection card needs (section 05): the clean product shot
 * by default, and a photo of someone wearing them on hover. `hover` is null
 * when no such photo exists yet, and the card simply does not swap.
 */
export function cardImages(product: CatalogProduct): {
  base: CatalogImage | null;
  hover: CatalogImage | null;
} {
  const all = product.variants.flatMap((v) => v.images);
  const base =
    all.find((i) => i.isPrimary && i.type === "PRODUCT") ??
    all.find((i) => i.type === "PRODUCT") ??
    heroImage(product);
  const hover =
    all.find((i) => i.type === "MODEL") ??
    all.find((i) => i.type === "LIFESTYLE") ??
    null;
  return { base, hover: hover?.id === base?.id ? null : hover };
}

/** Product gallery in the order the brief asks for. */
export function galleryFor(variant: CatalogVariant): CatalogImage[] {
  return [...variant.images].sort(
    (a, b) => IMAGE_TYPE_ORDER[a.type] - IMAGE_TYPE_ORDER[b.type],
  );
}

// Price formatting lives in `@/lib/utils` (formatPrice, STORE_CURRENCY): this
// module imports the database client, so client components must not import it.
