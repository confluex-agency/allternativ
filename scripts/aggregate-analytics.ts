/**
 * Daily cron: aggregates sessions + events from previous day into daily_analytics.
 * Run at 02:00 UTC via Render cron.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setUTCHours(23, 59, 59, 999);

  console.log(`Aggregating analytics for ${yesterday.toISOString().split("T")[0]}`);

  // Sessions from yesterday
  const sessions = await prisma.session.findMany({
    where: { landedAt: { gte: yesterday, lte: endOfYesterday } },
  });

  const totalSessions = sessions.length;
  const uniqueVisitors = new Set(sessions.map((s) => s.visitorId)).size;
  const avgDuration =
    totalSessions > 0
      ? sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / totalSessions
      : 0;
  const bounceRate =
    totalSessions > 0
      ? sessions.filter((s) => s.pageCount <= 1).length / totalSessions
      : 0;

  // Page views
  const pageViews = await prisma.trackingEvent.count({
    where: {
      eventType: "page_view",
      timestamp: { gte: yesterday, lte: endOfYesterday },
    },
  });

  // Orders
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: yesterday, lte: endOfYesterday },
      status: { not: "CANCELLED" },
    },
  });

  const totalOrders = orders.length;
  const totalRevenueCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const conversionRate = totalSessions > 0 ? totalOrders / totalSessions : 0;

  // Top sources
  const sourceCounts = new Map<string, number>();
  for (const s of sessions) {
    const source = s.utmSource || s.referrer || "direct";
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  }
  const topSources = Object.fromEntries(
    [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  );

  // Top countries
  const countryCounts = new Map<string, number>();
  for (const s of sessions) {
    const country = s.country || "Unknown";
    countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
  }
  const topCountries = Object.fromEntries(
    [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  );

  // Top products viewed
  const productViews = await prisma.trackingEvent.findMany({
    where: {
      eventType: "product_view",
      timestamp: { gte: yesterday, lte: endOfYesterday },
    },
    select: { metadata: true },
  });
  const productCounts = new Map<string, number>();
  for (const pv of productViews) {
    const name = (pv.metadata as Record<string, unknown>)?.productName;
    if (typeof name === "string") {
      productCounts.set(name, (productCounts.get(name) || 0) + 1);
    }
  }
  const topProductsViewed = Object.fromEntries(
    [...productCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  );

  // Top search terms
  const searchEvents = await prisma.trackingEvent.findMany({
    where: {
      eventType: "search",
      timestamp: { gte: yesterday, lte: endOfYesterday },
    },
    select: { metadata: true },
  });
  const termCounts = new Map<string, number>();
  for (const se of searchEvents) {
    const query = (se.metadata as Record<string, unknown>)?.query;
    if (typeof query === "string" && query.trim()) {
      const term = query.trim().toLowerCase();
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    }
  }
  const topSearchTerms = Object.fromEntries(
    [...termCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  );

  // Upsert daily analytics
  await prisma.dailyAnalytics.upsert({
    where: { date: yesterday },
    update: {
      totalSessions,
      uniqueVisitors,
      pageViews,
      avgSessionDuration: avgDuration,
      bounceRate,
      totalOrders,
      totalRevenueCents,
      conversionRate,
      topSources,
      topCountries,
      topProductsViewed,
      topSearchTerms,
    },
    create: {
      date: yesterday,
      totalSessions,
      uniqueVisitors,
      pageViews,
      avgSessionDuration: avgDuration,
      bounceRate,
      totalOrders,
      totalRevenueCents,
      conversionRate,
      topSources,
      topCountries,
      topProductsViewed,
      topSearchTerms,
    },
  });

  console.log("Aggregation complete:", {
    totalSessions,
    uniqueVisitors,
    pageViews,
    totalOrders,
    totalRevenueCents,
  });
}

main()
  .catch((e) => {
    console.error("Aggregation failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
