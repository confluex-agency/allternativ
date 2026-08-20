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
  /**
   * Images that belong to the model rather than to one colourway
   * (`ProductImage.variantId` is null). A photo attached to a colourway is a
   * statement about what that colourway looks like; a shared one is not, which
   * is where the stand-in imagery lives until the real shoot is delivered.
   */
  sharedImages: CatalogImage[];
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
      // Only the ones no colourway claims: the rest arrive under their variant
      // above, and including them twice would duplicate every gallery.
      images: { where: { variantId: null }, orderBy: { position: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
}

const toCatalogImage = (i: ProductRow["images"][number]): CatalogImage => ({
  id: i.id,
  url: i.url,
  altText: i.altText,
  type: i.type,
  isPrimary: i.isPrimary,
});

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
      images: v.images.map(toCatalogImage),
    })),
    sharedImages: row.images.map(toCatalogImage),
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

// ─── Collections (section 05) ───────────────────────────────────────────────
// The brief is explicit that collections, not categories, are how the shop is
// organised, and that COLLECTIONS is the main ecommerce entry point.

export type CatalogCollection = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  /** Editorial introduction. Null renders nothing rather than a placeholder. */
  description: string | null;
  heroImageUrl: string | null;
  heroVideoUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Live products, in the order the collection puts them in. */
  products: CatalogProduct[];
};

/** Every collection the public shop may show, in the order they are pinned. */
export async function getLiveCollections() {
  return prisma.collection.findMany({
    where: { status: "LIVE" },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { slug: true, name: true },
  });
}

export async function getCollectionBySlug(
  slug: string,
): Promise<CatalogCollection | null> {
  const collection = await prisma.collection.findFirst({
    where: { slug, status: "LIVE" },
    include: {
      products: {
        orderBy: { position: "asc" },
        select: { productId: true },
      },
    },
  });
  if (!collection) return null;

  // Two queries rather than one, on purpose. The membership rows carry the
  // hand-set order the client reorders products with, and the products
  // themselves need the same deep include every other catalogue read uses.
  // Fetching them separately keeps that include in one place.
  const ids = collection.products.map((p) => p.productId);
  const rows = ids.length
    ? await findProducts({ id: { in: ids }, status: "LIVE" })
    : [];

  // `findProducts` orders by creation date, so the collection's own order has
  // to be reapplied here. A product that is no longer live simply drops out.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const products = ids
    .map((id) => byId.get(id))
    .filter((r) => r !== undefined)
    .map(toCatalogProduct);

  return {
    id: collection.id,
    slug: collection.slug,
    name: collection.name,
    tagline: collection.tagline,
    description: collection.description,
    heroImageUrl: collection.heroImageUrl,
    heroVideoUrl: collection.heroVideoUrl,
    metaTitle: collection.metaTitle,
    metaDescription: collection.metaDescription,
    products,
  };
}

/** Slugs for generating static collection pages. */
export async function getLiveCollectionSlugs(): Promise<string[]> {
  const rows = await prisma.collection.findMany({
    where: { status: "LIVE" },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
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

/**
 * True when nothing on this model can be bought.
 *
 * The client asked for sold-out pieces to stay on the grid rather than
 * disappear from it: "cuando un colourway llegue a stock 0 no queremos
 * ocultarlo, queremos que siga visible pero marcado SOLD OUT". Hiding them also
 * throws away the demand signal of people still clicking on one.
 */
export function isSoldOut(product: CatalogProduct): boolean {
  return product.variants.every((v) => !v.inStock);
}

/** The variant shown before the visitor picks a colour. */
export function defaultVariant(product: CatalogProduct): CatalogVariant | null {
  return product.variants[0] ?? null;
}

/**
 * Every image the product can show, colourway ones first.
 *
 * The fallback to shared images is what keeps a model with no per-colourway
 * photography from rendering as an empty card.
 */
function allImages(product: CatalogProduct): CatalogImage[] {
  return [
    ...product.variants.flatMap((v) => v.images),
    ...product.sharedImages,
  ];
}

/** The one image that represents a product in a grid. */
export function heroImage(product: CatalogProduct): CatalogImage | null {
  const all = allImages(product);
  return all.find((i) => i.isPrimary) ?? all[0] ?? null;
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
  const all = allImages(product);
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

/**
 * Product gallery in the order the brief asks for.
 *
 * A colourway with no photography of its own falls back to the model's shared
 * images, so the page never renders a blank gallery.
 */
export function galleryFor(
  product: CatalogProduct,
  variant: CatalogVariant,
): CatalogImage[] {
  const images = variant.images.length ? variant.images : product.sharedImages;
  return [...images].sort(
    (a, b) => IMAGE_TYPE_ORDER[a.type] - IMAGE_TYPE_ORDER[b.type],
  );
}

// Price formatting lives in `@/lib/utils` (formatPrice, STORE_CURRENCY): this
// module imports the database client, so client components must not import it.
