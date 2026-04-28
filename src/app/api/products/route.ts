import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthFromCookies } from "@/lib/auth";

const ProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  description: z.string().max(5000).optional(),
  priceCents: z.number().int().min(0).max(100_000_000),
  compareAtPriceCents: z.number().int().min(0).max(100_000_000).optional(),
  stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  type: z.enum(["OPTICAL", "SUNGLASSES", "BLUE_LIGHT", "READING"]),
  frameShape: z
    .enum([
      "ROUND",
      "SQUARE",
      "AVIATOR",
      "CAT_EYE",
      "RECTANGLE",
      "OVAL",
      "BROWLINE",
      "GEOMETRIC",
    ])
    .optional(),
  frameMaterial: z
    .enum(["ACETATE", "METAL", "TITANIUM", "TR90", "WOOD", "MIXED"])
    .optional(),
  lensType: z.string().max(100).optional(),
  frameColor: z.string().max(50).optional(),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]).default("UNISEX"),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
});

const ProductTypeFilter = z.enum([
  "OPTICAL",
  "SUNGLASSES",
  "BLUE_LIGHT",
  "READING",
]);

const ALLOWED_WRITE_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "EDITOR"]);

// Public: list active products
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const typeRaw = searchParams.get("type");
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const search = searchParams.get("q");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "24", 10)),
  );

  const typeFilter = typeRaw ? ProductTypeFilter.safeParse(typeRaw) : null;

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(typeFilter?.success ? { type: typeFilter.data } : {}),
      ...(featured === "true" ? { isFeatured: true } : {}),
      ...(category
        ? { categories: { some: { category: { slug: category } } } }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      categories: { include: { category: true } },
    },
    orderBy: { createdAt: "desc" },
    take: pageSize,
    skip: (page - 1) * pageSize,
  });

  return NextResponse.json(products);
}

// Admin: create product
export async function POST(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED_WRITE_ROLES.has(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = ProductSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid product payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const product = await prisma.product.create({ data: parsed.data });
    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 },
    );
  }
}
