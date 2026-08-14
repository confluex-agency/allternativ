/**
 * Housekeeping for the payment path. Safe to run as often as you like.
 *
 *   npx tsx scripts/sweep-orders.ts
 *
 * Two jobs:
 *
 * 1. Hand expired stock reservations back. Abandoned checkouts release
 *    themselves on the next purchase attempt anyway, but a shop with no traffic
 *    would otherwise sit on locked stock until someone tried to buy.
 *
 * 2. Retry webhook events that failed for a transient reason. Stripe retries on
 *    its own for three days; this covers what is left after that, and gives a
 *    way to push a stuck event through by hand.
 *
 * Events marked FAILED by an UnprocessableEventError are NOT retried here: they
 * are broken in a way that time does not fix. They stay in the table with their
 * reason, which is the point of keeping the table.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import type Stripe from "stripe";
import { processStripeEvent } from "../src/lib/webhooks/process-stripe-event";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

/** Older than this and a failed event is not worth retrying automatically. */
const RETRY_WINDOW_HOURS = 72;
const MAX_ATTEMPTS = 10;

async function releaseExpired(): Promise<number> {
  const expired = await prisma.stockReservation.findMany({
    where: { releasedAt: null, expiresAt: { lt: new Date() } },
    select: { id: true, variantId: true, quantity: true },
  });

  let released = 0;
  for (const reservation of expired) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.stockReservation.updateMany({
        where: { id: reservation.id, releasedAt: null },
        data: { releasedAt: new Date(), consumed: false },
      });
      if (claimed.count === 0) return;

      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: { stockQuantity: { increment: reservation.quantity } },
      });
      released++;
    });
  }
  return released;
}

async function retryFailedEvents(): Promise<{ ok: number; stillFailing: number }> {
  const since = new Date(Date.now() - RETRY_WINDOW_HOURS * 60 * 60 * 1000);
  const failed = await prisma.webhookEvent.findMany({
    where: {
      status: "FAILED",
      createdAt: { gte: since },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let ok = 0;
  let stillFailing = 0;

  for (const record of failed) {
    try {
      await processStripeEvent(record.payload as unknown as Stripe.Event);
      await prisma.webhookEvent.update({
        where: { id: record.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          lastError: null,
          attempts: { increment: 1 },
        },
      });
      ok++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await prisma.webhookEvent.update({
        where: { id: record.id },
        data: { lastError: message, attempts: { increment: 1 } },
      });
      stillFailing++;
    }
  }

  return { ok, stillFailing };
}

async function main() {
  const released = await releaseExpired();
  console.log(`Reservations released: ${released}`);

  const { ok, stillFailing } = await retryFailedEvents();
  console.log(`Webhook events recovered: ${ok} | still failing: ${stillFailing}`);

  // Anything sitting here needs a person, so say so loudly rather than exiting 0
  // as if all were well.
  const stuck = await prisma.webhookEvent.count({ where: { status: "FAILED" } });
  if (stuck > 0) {
    console.error(`⚠️  ${stuck} webhook event(s) still failed. Inspect webhook_events.`);
  }

  const negative = await prisma.productVariant.findMany({
    where: { stockQuantity: { lt: 0 } },
    select: { sku: true, stockQuantity: true },
  });
  if (negative.length > 0) {
    console.error(
      `⚠️  Negative stock, sold more than held: ${negative
        .map((v) => `${v.sku} (${v.stockQuantity})`)
        .join(", ")}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
