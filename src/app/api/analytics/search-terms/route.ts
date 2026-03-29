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

  const searchEvents = await prisma.trackingEvent.findMany({
    where: { eventType: "search", timestamp: { gte: since } },
    select: { metadata: true, timestamp: true },
    orderBy: { timestamp: "desc" },
  });

  // Aggregate search terms
  const termCounts = new Map<string, number>();
  for (const event of searchEvents) {
    const query = (event.metadata as Record<string, unknown>)?.query;
    if (typeof query === "string" && query.trim()) {
      const term = query.trim().toLowerCase();
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    }
  }

  const terms = Array.from(termCounts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return NextResponse.json(terms);
}
