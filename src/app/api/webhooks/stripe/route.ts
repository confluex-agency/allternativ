import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  processStripeEvent,
  UnprocessableEventError,
} from "@/lib/webhooks/process-stripe-event";

// The route does two things and no more: prove the event came from Stripe, and
// write it down. Deciding what it means is `processStripeEvent`, so a failed
// event can be replayed later from the record instead of being lost.
//
// Stripe is the durable queue here. It retries a webhook that answers 5xx, with
// backoff, for up to three days, and `stripeEventId` being unique makes those
// retries harmless. What we add is the log: what arrived, what failed and why.

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Record first. If the process dies immediately after this line, the event is
  // still on disk and can be replayed.
  const record = await prisma.webhookEvent.upsert({
    where: { stripeEventId: event.id },
    update: { attempts: { increment: 1 } },
    create: {
      stripeEventId: event.id,
      type: event.type,
      payload: JSON.parse(body),
      attempts: 1,
    },
  });

  if (record.status === "PROCESSED") {
    return NextResponse.json({ received: true, idempotent: true });
  }

  try {
    await processStripeEvent(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // An event that can never succeed is closed rather than retried for three
    // days: malformed metadata will still be malformed tomorrow. It stays in the
    // table as FAILED with its reason, which is where someone will look.
    const permanent = error instanceof UnprocessableEventError;

    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: "FAILED", lastError: message },
    });

    console.error(`[webhook] ${event.type} ${event.id} failed: ${message}`);

    if (permanent) {
      return NextResponse.json({ received: true, failed: true });
    }
    // Transient: answer 5xx so Stripe tries again.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  await prisma.webhookEvent.update({
    where: { id: record.id },
    data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
  });

  return NextResponse.json({ received: true });
}
