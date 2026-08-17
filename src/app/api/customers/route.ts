import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, COMMERCIAL_ROLES } from "@/lib/auth";

// Same reasoning as orders: this is personal data, and a session alone was
// never the right bar for reading it.

export async function GET(request: NextRequest) {
  const auth = await requireRole(...COMMERCIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)),
  );

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true } } },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.customer.count(),
  ]);

  return NextResponse.json({ customers, total, page, pageSize });
}
