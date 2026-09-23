import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { confirmSubscription } from "@/lib/newsletter";
import { isSameOrigin } from "@/lib/same-origin";

const Body = z.object({ token: z.string().min(1).max(64) });

/**
 * POST /api/newsletter/confirm — spends the link from the confirmation mail.
 *
 * A POST, pressed from the page the link opens, and never the page load
 * itself: a mail scanner or a link preview fetches the URL with a GET, and
 * would otherwise subscribe people who never clicked anything.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ result: "invalid" }, { status: 400 });
  }
  const result = await confirmSubscription(parsed.data.token);
  return NextResponse.json(
    { result },
    { status: result === "confirmed" ? 200 : 400 },
  );
}
