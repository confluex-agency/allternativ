import { NextRequest, NextResponse } from "next/server";
import { ContactSchema, submitContactMessage } from "@/lib/contact";
import {
  contactLimiter,
  contactDailyLimiter,
  getClientIp,
} from "@/lib/rate-limit";
import { COMPANY } from "@/lib/legal";
import { isSameOrigin } from "@/lib/same-origin";

// Comfortably above the largest valid message (5000 characters of text, which
// is at most ~20 KB of UTF-8, plus the other fields), and small enough that
// nobody can make the server parse a megabyte to find out it was refused.
const MAX_BODY_BYTES = 24_000;

/**
 * POST /api/contact
 *
 * Unauthenticated by nature, since anybody may write to the shop, so every
 * check a session would normally stand in for is made here instead:
 *
 * 1. **Origin.** Only the shop's own pages may post here. This is not a bot
 *    filter, since a script can send any header it likes; it stops another
 *    site from posting through a visitor's browser.
 * 2. **Size**, before parsing.
 * 3. **Shape**, through `ContactSchema`, which also cleans what it accepts.
 * 4. **Honeypot.** Filled means a bot, and a bot is answered exactly like a
 *    person, so it has nothing to learn from the response.
 * 5. **Rate**, per visitor and for the whole shop.
 *
 * The message is written to the database before this answers, and "received"
 * means exactly that. See `src/lib/contact.ts`.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "That message is too long" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid details" },
      { status: 400 },
    );
  }

  const { website, ...message } = parsed.data;
  if (website) {
    return NextResponse.json({ received: true });
  }

  try {
    const ip = getClientIp(request.headers);
    const perVisitor = await contactLimiter.limit(`ip:${ip}`);
    if (!perVisitor.success) {
      return NextResponse.json(
        {
          error:
            "You have sent several messages in a short time. Please wait a few minutes and try again.",
        },
        { status: 429 },
      );
    }
    const perDay = await contactDailyLimiter.limit("all");
    if (!perDay.success) {
      return NextResponse.json(
        {
          error: `The form is closed for today. Please write to ${COMPANY.contactEmail} instead.`,
        },
        { status: 429 },
      );
    }

    await submitContactMessage(message);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      {
        error: `Your message could not be saved. Please write to ${COMPANY.contactEmail} instead.`,
      },
      { status: 500 },
    );
  }
}
