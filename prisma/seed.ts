import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "bcryptjs";
import { mockProducts } from "../src/lib/mock-data";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create admin user. Initial password forces immediate change.
  const initialPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!Now-2026";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@allternativ.com";
  const passwordHash = await hash(initialPassword, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: "Admin",
      role: "SUPER_ADMIN",
      mustChangePassword: true,
    },
  });
  console.log("Created admin user:", admin.email);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn(
      "⚠️  Using default initial password. Login and change immediately.",
    );
  }

  // Create categories
  const categories = await Promise.all(
    [
      { name: "Optical", slug: "optical" },
      { name: "Sunglasses", slug: "sunglasses" },
      { name: "Blue Light", slug: "blue-light" },
      { name: "Reading", slug: "reading" },
      { name: "New Arrivals", slug: "new-arrivals" },
      { name: "Best Sellers", slug: "best-sellers" },
    ].map((cat) =>
      prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      })
    )
  );
  console.log("Created categories:", categories.length);

  // Map the ProductType union to the category slug it belongs in.
  const categorySlugForType: Record<string, string> = {
    OPTICAL: "optical",
    SUNGLASSES: "sunglasses",
    BLUE_LIGHT: "blue-light",
    READING: "reading",
  };

  // Seed the REAL catalogue straight from mock-data (single source of truth).
  // Each mock product becomes one Product row, each colourway a ProductVariant
  // (the buyable unit, carries the SKU), and every gallery image a ProductImage
  // linked to its variant. Image [0] of the first colourway is the hero.
  let productCount = 0;
  let variantCount = 0;
  for (const mp of mockProducts) {
    const product = await prisma.product.upsert({
      where: { slug: mp.slug },
      update: {},
      create: {
        name: mp.name,
        slug: mp.slug,
        description: mp.description ?? null,
        priceCents: mp.priceCents,
        compareAtPriceCents: mp.compareAtPriceCents ?? null,
        stockQuantity: 25,
        isActive: true,
        isFeatured: mp.slug === "orbital",
        type: mp.type,
        lensType: mp.lens ?? null,
        frameColor: mp.colorways[0]?.name ?? null,
        gender: "UNISEX",
        metaTitle: `${mp.name} — ${mp.tagline} | Allternativ`,
        metaDescription: mp.description ?? null,
      },
    });

    // One variant per colourway, each owning its own gallery.
    let imagePosition = 0;
    for (const [cwIndex, cw] of mp.colorways.entries()) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: cw.sku },
        update: {},
        create: {
          productId: product.id,
          sku: cw.sku,
          colorKey: cw.key,
          colorName: cw.name,
          swatch: cw.swatch,
          stockQuantity: 25,
          isActive: true,
          position: cwIndex,
        },
      });
      variantCount++;

      // Skip if this variant already has its gallery (re-run of the seed).
      const alreadySeeded = await prisma.productImage.count({
        where: { variantId: variant.id },
      });
      if (alreadySeeded === 0) {
        await prisma.productImage.createMany({
          data: cw.gallery.map((url, i) => ({
            productId: product.id,
            variantId: variant.id,
            url,
            altText: `${mp.name} — ${cw.name}`,
            position: imagePosition + i,
            isPrimary: cwIndex === 0 && i === 0,
          })),
        });
      }
      imagePosition += cw.gallery.length;
    }

    // Link to its type category, and feature-flagged products to best-sellers.
    const catSlug = categorySlugForType[mp.type] ?? "sunglasses";
    const cat = categories.find((c) => c.slug === catSlug);
    if (cat) {
      await prisma.categoriesOnProducts
        .create({ data: { productId: product.id, categoryId: cat.id } })
        .catch(() => {}); // ignore if already linked
    }
    if (product.isFeatured) {
      const best = categories.find((c) => c.slug === "best-sellers");
      if (best) {
        await prisma.categoriesOnProducts
          .create({ data: { productId: product.id, categoryId: best.id } })
          .catch(() => {});
      }
    }
    productCount++;
  }

  console.log("Created products:", productCount, "| variants:", variantCount);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
