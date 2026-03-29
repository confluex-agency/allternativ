import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create admin user
  const passwordHash = await hash("admin123", 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@allternativ.com" },
    update: {},
    create: {
      email: "admin@allternativ.com",
      passwordHash,
      name: "Admin",
      role: "SUPER_ADMIN",
      mustChangePassword: true,
    },
  });
  console.log("Created admin user:", admin.email);

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

  // Create sample products
  const products = [
    {
      name: "Classic Round",
      slug: "classic-round",
      description:
        "Timeless round frames crafted from premium acetate. Lightweight and comfortable for all-day wear.",
      priceCents: 12900,
      compareAtPriceCents: 15900,
      stockQuantity: 50,
      isActive: true,
      isFeatured: true,
      type: "OPTICAL" as const,
      frameShape: "ROUND" as const,
      frameMaterial: "ACETATE" as const,
      frameColor: "Tortoise",
      gender: "UNISEX" as const,
      metaTitle: "Classic Round Optical Frames | Allternativ",
      metaDescription:
        "Premium round acetate frames. Lightweight, comfortable, timeless design.",
    },
    {
      name: "Aviator Pro",
      slug: "aviator-pro",
      description:
        "Bold aviator sunglasses with polarized lenses. UV400 protection with a modern twist on the classic design.",
      priceCents: 15900,
      stockQuantity: 35,
      isActive: true,
      isFeatured: true,
      type: "SUNGLASSES" as const,
      frameShape: "AVIATOR" as const,
      frameMaterial: "METAL" as const,
      frameColor: "Gold",
      gender: "UNISEX" as const,
      lensType: "Polarized",
      metaTitle: "Aviator Pro Sunglasses | Allternativ",
      metaDescription:
        "Polarized aviator sunglasses with UV400 protection. Gold metal frames.",
    },
    {
      name: "Digital Shield",
      slug: "digital-shield",
      description:
        "Blue light blocking glasses designed for screen time. Reduce eye strain with style.",
      priceCents: 8900,
      stockQuantity: 100,
      isActive: true,
      isFeatured: false,
      type: "BLUE_LIGHT" as const,
      frameShape: "RECTANGLE" as const,
      frameMaterial: "TR90" as const,
      frameColor: "Matte Black",
      gender: "UNISEX" as const,
      lensType: "Blue Light Filter",
      metaTitle: "Digital Shield Blue Light Glasses | Allternativ",
      metaDescription:
        "Blue light blocking glasses for screen time. TR90 frames, lightweight design.",
    },
    {
      name: "Cat Eye Luxe",
      slug: "cat-eye-luxe",
      description:
        "Elegant cat-eye frames with a contemporary silhouette. Premium acetate construction.",
      priceCents: 13900,
      stockQuantity: 40,
      isActive: true,
      isFeatured: true,
      type: "OPTICAL" as const,
      frameShape: "CAT_EYE" as const,
      frameMaterial: "ACETATE" as const,
      frameColor: "Black",
      gender: "WOMEN" as const,
      metaTitle: "Cat Eye Luxe Optical Frames | Allternativ",
      metaDescription:
        "Elegant cat-eye acetate frames for women. Contemporary design.",
    },
    {
      name: "Titanium Square",
      slug: "titanium-square",
      description:
        "Ultra-lightweight titanium frames with a clean square profile. Hypoallergenic and durable.",
      priceCents: 19900,
      stockQuantity: 25,
      isActive: true,
      isFeatured: false,
      type: "OPTICAL" as const,
      frameShape: "SQUARE" as const,
      frameMaterial: "TITANIUM" as const,
      frameColor: "Gunmetal",
      gender: "MEN" as const,
      metaTitle: "Titanium Square Frames | Allternativ",
      metaDescription:
        "Ultra-lightweight titanium square frames. Hypoallergenic, durable, premium.",
    },
    {
      name: "Reader Classic",
      slug: "reader-classic",
      description:
        "Comfortable reading glasses available in multiple strengths. Spring hinges for a perfect fit.",
      priceCents: 4900,
      stockQuantity: 200,
      isActive: true,
      isFeatured: false,
      type: "READING" as const,
      frameShape: "RECTANGLE" as const,
      frameMaterial: "ACETATE" as const,
      frameColor: "Dark Brown",
      gender: "UNISEX" as const,
      lensType: "+1.50",
      metaTitle: "Reader Classic Reading Glasses | Allternativ",
      metaDescription:
        "Comfortable reading glasses with spring hinges. Multiple strengths available.",
    },
  ];

  for (const productData of products) {
    const product = await prisma.product.upsert({
      where: { slug: productData.slug },
      update: {},
      create: productData,
    });

    // Add placeholder images
    await prisma.productImage.createMany({
      data: [
        {
          productId: product.id,
          url: `/images/products/${product.slug}-1.jpg`,
          altText: `${product.name} - Front view`,
          position: 0,
          isPrimary: true,
        },
        {
          productId: product.id,
          url: `/images/products/${product.slug}-2.jpg`,
          altText: `${product.name} - Side view`,
          position: 1,
          isPrimary: false,
        },
      ],
      skipDuplicates: true,
    });

    // Link to appropriate category
    const categorySlug =
      productData.type === "OPTICAL"
        ? "optical"
        : productData.type === "SUNGLASSES"
          ? "sunglasses"
          : productData.type === "BLUE_LIGHT"
            ? "blue-light"
            : "reading";

    const category = categories.find((c) => c.slug === categorySlug);
    if (category) {
      await prisma.categoriesOnProducts
        .create({
          data: { productId: product.id, categoryId: category.id },
        })
        .catch(() => {}); // ignore if already exists
    }

    // Featured products go to best-sellers
    if (productData.isFeatured) {
      const bestSellers = categories.find((c) => c.slug === "best-sellers");
      if (bestSellers) {
        await prisma.categoriesOnProducts
          .create({
            data: { productId: product.id, categoryId: bestSellers.id },
          })
          .catch(() => {});
      }
    }
  }

  console.log("Created products:", products.length);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
