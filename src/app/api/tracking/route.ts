import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { trackingLimiter, getClientIp } from "@/lib/rate-limit";

const EventSchema = z.object({
  eventType: z.string().min(1).max(64),
  pagePath: z.string().max(500).optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const PayloadSchema = z.object({
  visitorId: z.string().min(1).max(64),
  sessionId: z.string().min(1).max(64),
  events: z.array(EventSchema).max(50),
  utm: z
    .object({
      utm_source: z.string().max(200).optional(),
      utm_medium: z.string().max(200).optional(),
      utm_campaign: z.string().max(200).optional(),
    })
    .optional(),
  referrer: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

    const { success } = await trackingLimiter.limit(ipHash);
    if (!success) {
      return new NextResponse(null, { status: 429 });
    }

    const parsed = PayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return new NextResponse(null, { status: 400 });
    }
    const { visitorId, sessionId, events, utm, referrer } = parsed.data;
    void sessionId;

    const userAgentStr = (request.headers.get("user-agent") || "").slice(0, 500);

    let session = await prisma.session.findFirst({
      where: {
        visitorId,
        landedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
      orderBy: { landedAt: "desc" },
    });

    if (!session) {
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

    if (events.length > 0) {
      await prisma.trackingEvent.createMany({
        data: events.map((e) => ({
          sessionId: session.id,
          eventType: e.eventType,
          pagePath: e.pagePath || null,
          timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
          metadata: (e.metadata as never) || undefined,
        })),
      });

      const pageViews = events.filter((e) => e.eventType === "page_view").length;
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
