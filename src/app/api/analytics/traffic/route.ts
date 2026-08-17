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

  const dailyData = await prisma.dailyAnalytics.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(dailyData);
}
