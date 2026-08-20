import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "bcryptjs";
import {
  CASE_OPENING_STOCK,
  catalogueProducts,
  RETIRED_SLUGS,
} from "../src/lib/catalogue-source";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create admin user. Initial password forces immediate change.
  const initialPassword =
    process.env.SEED_ADMIN_PASSWORD || "ChangeMe!Now-2026";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@allternativ.com";
  const passwordHash = await hash(initialPassword, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: "Admin",
      role: "OWNER",
      mustChangePassword: true,
    },
  });
  console.log("Created admin user:", admin.email);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn(
      "⚠️  Using default initial password. Login and change immediately.",
    );
  }

  // The two cases every pair ships in, bought up front like the frames.
  // 150 of each, confirmed by the client from the supplier's invoice: 300
  // leather cases, 150 white and 150 black. The rows seeded before those
  // numbers arrived hold 100, an openly fake placeholder.
  //
  // Opening stock is written whenever NOTHING has consumed that colour yet.
  // A blanket write would put sold cases back on the shelf on every re-seed; a
  // create-only write leaves the placeholder standing forever, which is what it
  // did until this check existed. The order items are the evidence.
  for (const c of [
    { key: "BLACK" as const, name: "Black" },
    { key: "WHITE" as const, name: "White" },
  ]) {
    const consumed = await prisma.orderItem.count({
      where: { caseColor: c.key },
    });
    await prisma.caseStock.upsert({
      where: { key: c.key },
      update: consumed
        ? { name: c.name }
        : { name: c.name, stockQuantity: CASE_OPENING_STOCK[c.key] },
      create: { ...c, stockQuantity: CASE_OPENING_STOCK[c.key] },
    });
  }
  // Read back rather than echoing the constant: the previous version printed the
  // figure it wanted, while the table still held 100.
  for (const row of await prisma.caseStock.findMany({
    orderBy: { key: "asc" },
  })) {
    console.log(`Case stock ${row.key}: ${row.stockQuantity}`);
  }

  // Retire the placeholder models we invented while the client had not named
  // theirs. DISCONTINUED and not deleted: an order may already point at one, and
  // an order must never lose what it was for. `getLiveProducts()` filters on
  // LIVE, so they leave the shop either way.
  const retired = await prisma.product.updateMany({
    where: { slug: { in: [...RETIRED_SLUGS] } },
    data: {
      status: "DISCONTINUED",
      isFeatured: false,
      // The invented specs go with them. Discontinued is not deleted: these rows
      // are still readable from the admin and the analytics, and "Handcrafted ·
      // LATAM" on goods made in China is a false claim wherever it is stored.
      description: null,
      frameDetail: null,
      origin: null,
      lensType: null,
      lensMaterial: null,
    },
  });
  if (retired.count) {
    console.log("Retired placeholder models:", retired.count);
  }
  // Their colourways would otherwise stay sellable through a direct SKU lookup.
  await prisma.productVariant.updateMany({
    where: { product: { slug: { in: [...RETIRED_SLUGS] } } },
    data: { isActive: false },
  });
  // And they must leave the collection, or the drop page lists eleven models
  // when the drop has six. Unlike the product row, this link carries no history
  // worth keeping: the order records what was bought, not what it sat beside.
  await prisma.productsOnCollections.deleteMany({
    where: { product: { slug: { in: [...RETIRED_SLUGS] } } },
  });
  // The galleries that hung off those colourways are dead rows: nothing renders
  // them once the variant is inactive, and they are stand-in imagery besides.
  await prisma.productImage.deleteMany({
    where: { product: { slug: { in: [...RETIRED_SLUGS] } } },
  });
  await prisma.productImage.deleteMany({
    where: { variant: { isActive: false } },
  });

  // The launch collection, confirmed by the client: "COLLECTION 01", the six
  // models below. A second drop follows later, which is why this is a real
  // Collection row and not a hardcoded page.
  //
  // The editorial introduction is the client's own section 03 copy, reused
  // here. It is NOT written for this page and is marked as such: they told us
  // the collection's theme is still to be defined, so borrowing approved copy
  // beats inventing a drop story they never signed off on.
  const collectionCopy = {
    name: "Collection 01",
    tagline: "A frequency you can wear.",
    description:
      "Designed for movement, light, and energy. Every pair is created to be worn in motion, at festivals, sunsets, city nights and moments that don't feel fully real.",
    // Campaign image asked for by section 05. Placeholder like the rest of the
    // imagery, and under /campaign/ so the same purge finds it.
    heroImageUrl: "/campaign/lifestyle-festival.webp",
    metaTitle: "Collection 01 — Allternativ",
    metaDescription:
      "A frequency you can wear. Six models, sixteen colourways.",
  };
  const collection = await prisma.collection.upsert({
    where: { slug: "collection-01" },
    update: collectionCopy,
    create: {
      ...collectionCopy,
      slug: "collection-01",
      status: "LIVE",
      isFeatured: true,
    },
  });
  console.log("Created collection:", collection.name);

  // Seed the launch catalogue. Each entry becomes one Product row, each
  // colourway a ProductVariant (the buyable unit, carrying the SKU and the
  // stock), and the stand-in imagery a ProductImage with no variant.
  let productCount = 0;
  let variantCount = 0;
  let unitCount = 0;
  for (const sp of catalogueProducts) {
    const openingStock = sp.colorways.reduce((n, cw) => n + cw.stock, 0);
    unitCount += openingStock;

    // ⚠️ Every published spec is written as null, on both branches. This is not
    // an oversight: the previous catalogue carried invented values (a frame
    // material, a lens material and "Handcrafted · LATAM" on goods made in
    // China), and a re-run has to SCRUB them, not leave them standing. The
    // client sends confirmed specs separately; until then the fields stay empty
    // and the product page simply omits the section.
    const unpublishedSpecs = {
      description: null,
      frameDetail: null,
      origin: null,
      lensType: null,
      lensMaterial: null,
      uvProtection: null,
      lensCategory: null,
      dimensionsMm: null,
      weightGrams: null,
      fit: null,
      frameMaterial: null,
      frameShape: null,
    };

    const product = await prisma.product.upsert({
      where: { slug: sp.slug },
      // While this file is still the source of truth, re-running the seed
      // refreshes the copy that comes from it. Once the admin CRUD ships this
      // has to go back to `update: {}`, or it will overwrite the client's edits.
      // Note what is NOT refreshed: stockQuantity. Re-seeding a shop that has
      // sold something must not put the sold units back.
      update: {
        name: sp.name,
        code: sp.code,
        tagline: sp.tagline,
        feeling: sp.feeling,
        priceCents: sp.priceCents,
        status: sp.status,
        metaTitle: `${sp.name} — ${sp.tagline} | Allternativ`,
        metaDescription: sp.tagline,
        ...unpublishedSpecs,
      },
      create: {
        name: sp.name,
        slug: sp.slug,
        code: sp.code,
        tagline: sp.tagline,
        feeling: sp.feeling,
        priceCents: sp.priceCents,
        compareAtPriceCents: null,
        stockQuantity: openingStock,
        status: sp.status,
        isFeatured: sp.slug === "orbital",
        type: sp.type,
        frameColor: sp.colorways[0]?.name ?? null,
        gender: "UNISEX",
        metaTitle: `${sp.name} — ${sp.tagline} | Allternativ`,
        metaDescription: sp.tagline,
        ...unpublishedSpecs,
      },
    });

    // One variant per colourway. Opening stock is set on create only.
    for (const [cwIndex, cw] of sp.colorways.entries()) {
      await prisma.productVariant.upsert({
        where: { sku: cw.sku },
        update: {
          colorName: cw.name,
          swatch: cw.swatch,
          supplierSku: cw.supplierSku,
          isActive: true,
          position: cwIndex,
        },
        create: {
          productId: product.id,
          sku: cw.sku,
          colorKey: cw.key,
          colorName: cw.name,
          swatch: cw.swatch,
          supplierSku: cw.supplierSku,
          stockQuantity: cw.stock,
          isActive: true,
          position: cwIndex,
        },
      });
      variantCount++;
    }

    // Colourways this model used to have and no longer does. Same reasoning as
    // the retired models: deactivated, never deleted, because an order item
    // points at them. Without this, Orbital keeps its two invented colourways
    // alongside the three real ones.
    await prisma.productVariant.updateMany({
      where: {
        productId: product.id,
        sku: { notIn: sp.colorways.map((cw) => cw.sku) },
      },
      data: { isActive: false },
    });

    // `Product.stockQuantity` is a denormalised total of the colourways, which
    // are what actually get reserved and shipped. Recomputed rather than
    // written from the source file: it is derived, so it can be rebuilt at any
    // time without ever putting a sold unit back.
    const live = await prisma.productVariant.aggregate({
      where: { productId: product.id, isActive: true },
      _sum: { stockQuantity: true },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { stockQuantity: live._sum.stockQuantity ?? 0 },
    });

    // Stand-in imagery, attached to the model and to no colourway. Replaced
    // wholesale on every run so the set always matches the source file.
    await prisma.productImage.deleteMany({
      where: { productId: product.id, variantId: null },
    });
    if (sp.placeholderImages.length) {
      await prisma.productImage.createMany({
        data: sp.placeholderImages.map((img, i) => ({
          productId: product.id,
          variantId: null,
          url: img.url,
          altText: sp.name,
          type: img.type,
          position: i,
          isPrimary: i === 0,
        })),
      });
    }

    // Every model belongs to the launch collection, in catalogue order.
    await prisma.productsOnCollections
      .create({
        data: {
          productId: product.id,
          collectionId: collection.id,
          position: productCount,
        },
      })
      .catch(() => {}); // already linked on a re-run
    productCount++;
  }

  console.log(
    `Catalogue: ${productCount} models | ${variantCount} colourways | ${unitCount} pairs`,
  );
  console.log(
    "⚠️  All product imagery is a placeholder. Purge with:\n" +
      "    DELETE FROM product_images WHERE url LIKE '/catalog/%';",
  );
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
