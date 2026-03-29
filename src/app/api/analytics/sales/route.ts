import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromCookies } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const days = parseInt(searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [orders, dailyData] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        customer: { select: { email: true, name: true } },
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
