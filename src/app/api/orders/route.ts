import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, COMMERCIAL_ROLES } from "@/lib/auth";

// Orders carry the buyer's name, address and phone. Being signed in to the
// admin is not enough to read them: this used to check only that a session
// existed, so a CONTENT_ADMIN could pull every customer's address.

export async function GET(request: NextRequest) {
  const auth = await requireRole(...COMMERCIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  // Paginated. It used to return every order in one response, which grows
  // without limit and hands the whole book over in a single request.
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)),
  );

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      include: {
        customer: { select: { id: true, email: true, name: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.order.count(),
  ]);

  return NextResponse.json({ orders, total, page, pageSize });
}
