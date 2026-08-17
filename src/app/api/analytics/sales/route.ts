import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, REPORTING_ROLES } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Dashboards are the one thing every admin role may read.
  const auth = await requireRole(...REPORTING_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const { searchParams } = request.nextUrl;
  const days = parseInt(searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [orders, dailyData] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      // An explicit allow-list, not the whole row. Dashboards are open to every
      // admin role including ANALYTICS_VIEWER, and an Order carries the buyer's
      // name, address and phone. A sales chart needs amounts and dates; the
      // order number is enough to label a row. Identifying the buyer is what
      // /api/orders is for, and that one is restricted to commercial roles.
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
      },
    }),
    prisma.dailyAnalytics.findMany({
      where: { date: { gte: since } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        totalOrders: true,
        totalRevenueCents: true,
        conversionRate: true,
      },
    }),
  ]);

  return NextResponse.json({ orders, dailyData });
}
