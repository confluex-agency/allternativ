import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { NewsletterSchema, requestSubscription } from "@/lib/newsletter";
import {
  newsletterLimiter,
  newsletterAddressLimiter,
  newsletterDailyLimiter,
  getClientIp,
} from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/same-origin";

const MAX_BODY_BYTES = 2_000;

/** What everybody is told, whatever happened. See `requestSubscription`. */
const ACCEPTED = { ok: true } as const;

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 32);

/**
 * POST /api/newsletter — the footer signup (D4).
 *
 * Built like `/api/contact`: origin, size, shape, honeypot, rate. The one
 * difference that matters is that this route's mail goes to the address the
 * visitor typed, so it answers identically for a new address, a pending one
 * and one already on the list. Anything else would let a stranger check
 * whether somebody is subscribed.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Invalid request" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = NewsletterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid email" },
      { status: 400 },
    );
  }
  if (parsed.data.website) return NextResponse.json(ACCEPTED);

  const { email } = parsed.data;
  const ipHash = hash(getClientIp(request.headers));

  try {
    const perVisitor = await newsletterLimiter.limit(`ip:${ipHash}`);
    if (!perVisitor.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429 },
      );
    }
    // Over the per-address limit, answer as if it worked: telling the caller
    // "this address has had enough mail today" is itself information about it.
    const perAddress = await newsletterAddressLimiter.limit(hash(email));
    if (!perAddress.success) return NextResponse.json(ACCEPTED);

    const perDay = await newsletterDailyLimiter.limit("all");
    if (!perDay.success) {
      return NextResponse.json(
        { error: "Signups are closed for today. Please try again tomorrow." },
        { status: 429 },
      );
    }

    // The row is written before this answers, so a provider that is down
    // delays the mail rather than losing the request: the sweep retries it.
    await requestSubscription({ email, ipHash });
    return NextResponse.json(ACCEPTED);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
