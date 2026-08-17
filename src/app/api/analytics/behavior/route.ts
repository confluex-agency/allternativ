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
  const days = parseInt(searchParams.get("days") || "7");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [clicks, scrolls, pageViews] = await Promise.all([
    prisma.trackingEvent.findMany({
      where: { eventType: "click", timestamp: { gte: since } },
      select: { pagePath: true, metadata: true, timestamp: true },
      take: 1000,
      orderBy: { timestamp: "desc" },
    }),
    prisma.trackingEvent.findMany({
      where: { eventType: "scroll", timestamp: { gte: since } },
      select: { pagePath: true, metadata: true },
      take: 500,
    }),
    prisma.trackingEvent.groupBy({
      by: ["pagePath"],
      where: { eventType: "page_view", timestamp: { gte: since } },
      _count: true,
      orderBy: { _count: { pagePath: "desc" } },
      take: 20,
    }),
  ]);

  return NextResponse.json({ clicks, scrolls, pageViews });
}
