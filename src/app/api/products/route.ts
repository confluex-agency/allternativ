import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromCookies } from "@/lib/auth";

// Public: list active products
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const search = searchParams.get("q");

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(type ? { type: type as never } : {}),
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
  });

  return NextResponse.json(products);
}

// Admin: create product
export async function POST(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const product = await prisma.product.create({ data: body });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
