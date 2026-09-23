import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { unsubscribe } from "@/lib/newsletter";
import { isSameOrigin } from "@/lib/same-origin";

const Body = z.object({ token: z.string().min(1).max(64) });

/**
 * POST /api/newsletter/unsubscribe — leave the list.
 *
 * A POST for the confirm route's reason: a scanner fetching a GET must not
 * unsubscribe anybody either. When campaigns exist, their mails will also need
 * a `List-Unsubscribe` header pointing here (RFC 8058); that belongs with the
 * sender, which does not exist yet.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ok = await unsubscribe(parsed.data.token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
