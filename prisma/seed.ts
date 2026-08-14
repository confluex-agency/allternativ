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

  // The launch collection. Name and tagline are PROVISIONAL: the client has not
  // defined collection names yet (they are marked "to be defined" in the brief).
  const collection = await prisma.collection.upsert({
    where: { slug: "collection-01" },
    update: {},
    create: {
      name: "Collection 01",
      slug: "collection-01",
      tagline: "A frequency you can wear.",
      status: "LIVE",
      isFeatured: true,
    },
  });
  console.log("Created collection:", collection.name);

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
        status: "LIVE",
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
            // Products flagged `photo` are the real street shoot, so they are
            // MODEL shots. Everything else is a studio product shot. Once the
            // client's shared folder lands, the file-name prefix sets this.
            type: mp.photo ? ("MODEL" as const) : ("PRODUCT" as const),
            position: imagePosition + i,
            isPrimary: cwIndex === 0 && i === 0,
          })),
        });
      }
      imagePosition += cw.gallery.length;
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

  console.log("Created products:", productCount, "| variants:", variantCount);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
