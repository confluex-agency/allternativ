import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { visitorId, sessionId, events, utm, referrer } = body;

    if (!visitorId || !sessionId || !Array.isArray(events)) {
      return new NextResponse(null, { status: 400 });
    }

    if (events.length > 50) {
      return new NextResponse(null, { status: 400 });
    }

    // Hash IP for privacy
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

    const userAgentStr = request.headers.get("user-agent") || "";

    // Upsert session
    let session = await prisma.session.findFirst({
      where: {
        visitorId,
        landedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
      orderBy: { landedAt: "desc" },
    });

    if (!session) {
      // Parse UA simply (full ua-parser-js can be added later)
      const isMobile = /mobile|android|iphone/i.test(userAgentStr);
      const isTablet = /tablet|ipad/i.test(userAgentStr);
      const deviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

      session = await prisma.session.create({
        data: {
          visitorId,
          referrer: referrer || null,
          utmSource: utm?.utm_source || null,
          utmMedium: utm?.utm_medium || null,
          utmCampaign: utm?.utm_campaign || null,
          userAgent: userAgentStr,
          deviceType,
          ipHash,
        },
      });
    }

    // Insert events
    if (events.length > 0) {
      await prisma.trackingEvent.createMany({
        data: events.map(
          (e: {
            eventType: string;
            pagePath?: string;
            timestamp?: string;
            metadata?: Record<string, unknown>;
          }) => ({
            sessionId: session.id,
            eventType: e.eventType,
            pagePath: e.pagePath || null,
            timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
            metadata: (e.metadata as never) || undefined,
          })
        ),
      });

      // Update session page count
      const pageViews = events.filter(
        (e: { eventType: string }) => e.eventType === "page_view"
      ).length;
      if (pageViews > 0) {
        await prisma.session.update({
          where: { id: session.id },
          data: { pageCount: { increment: pageViews } },
        });
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
