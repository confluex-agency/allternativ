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
// The shared one, deliberately: this script used to carry its own copy, which
// then quietly failed to hand cases back when case stock was introduced.
import { releaseExpiredReservations } from "../src/lib/inventory";
import {
  buildOrderConfirmation,
  sendEmail,
  outcomeForFailure,
  EMAIL_MAX_ATTEMPTS,
} from "../src/lib/email";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

/** Older than this and a failed event is not worth retrying automatically. */
const RETRY_WINDOW_HOURS = 72;
const MAX_ATTEMPTS = 10;

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

/**
 * Drain the confirmation-email queue.
 *
 * The third job, and the reason it is a job at all: the webhook must answer
 * Stripe in milliseconds, and a mail provider cannot be trusted to take
 * milliseconds. The order is written there, the mail is queued on it, and this
 * takes it from PENDING to SENT — or leaves it alone, which is the case worth
 * understanding.
 *
 * An order is only ever mailed once: SENT is written in the same update that
 * records the time, and the query only ever looks at PENDING.
 */
async function drainOrderEmails(): Promise<{
  sent: number;
  retrying: number;
  gaveUp: number;
  blocked: string | null;
}> {
  const queued = await prisma.order.findMany({
    where: {
      emailStatus: "PENDING",
      // Only a paid order gets a confirmation. A PENDING order has not been
      // paid for, and a cancelled one should not be thanked.
      status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
      emailAttempts: { lt: EMAIL_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { customer: true, items: true },
  });

  let sent = 0;
  let retrying = 0;
  let gaveUp = 0;
  let blocked: string | null = null;

  for (const order of queued) {
    if (!order.customer?.email) {
      // Nothing to send to, and no attempt will produce an address.
      await prisma.order.update({
        where: { id: order.id },
        data: {
          emailStatus: "FAILED",
          emailLastError: "Order has no customer email",
        },
      });
      gaveUp++;
      continue;
    }

    try {
      await sendEmail(buildOrderConfirmation(order.customer.email, order));
      await prisma.order.update({
        where: { id: order.id },
        data: {
          emailStatus: "SENT",
          emailSentAt: new Date(),
          emailAttempts: { increment: 1 },
          emailLastError: null,
        },
      });
      sent++;
    } catch (error) {
      const outcome = outcomeForFailure(order.emailAttempts, error);

      if (outcome.kind === "keep") {
        // No provider configured. Said once, not once per order, and the queue
        // is left exactly as it was so nothing is lost.
        blocked = outcome.reason;
        break;
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          emailStatus: outcome.kind === "giveUp" ? "FAILED" : "PENDING",
          emailAttempts: outcome.attempts,
          emailLastError: outcome.error,
        },
      });
      if (outcome.kind === "giveUp") gaveUp++;
      else retrying++;
    }
  }

  return { sent, retrying, gaveUp, blocked };
}

async function main() {
  const released = await releaseExpiredReservations();
  console.log(`Reservations released: ${released}`);

  const { ok, stillFailing } = await retryFailedEvents();
  console.log(`Webhook events recovered: ${ok} | still failing: ${stillFailing}`);

  const mail = await drainOrderEmails();
  console.log(
    `Confirmation emails sent: ${mail.sent} | retrying: ${mail.retrying} | ` +
      `given up: ${mail.gaveUp}`,
  );
  if (mail.blocked) {
    console.error(`⚠️  Email queue is not draining: ${mail.blocked}`);
  }
  if (mail.gaveUp > 0) {
    console.error(
      `⚠️  ${mail.gaveUp} order(s) will never be confirmed by email. The success ` +
        `page promised the buyer one, so somebody has to write to them by hand.`,
    );
  }

  // The backlog is worth shouting about even when nothing failed today: an
  // order stuck at PENDING is a promise the shop made and did not keep.
  const unconfirmed = await prisma.order.count({
    where: {
      emailStatus: "PENDING",
      status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
    },
  });
  if (unconfirmed > 0) {
    console.error(
      `⚠️  ${unconfirmed} paid order(s) still waiting for a confirmation email.`,
    );
  }

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

  const cases = await prisma.caseStock.findMany({ orderBy: { key: "asc" } });
  const emptyCases = cases.filter((c) => c.stockQuantity <= 0 && c.isActive);
  if (emptyCases.length > 0) {
    console.error(
      `⚠️  Cases out of stock, the shop has stopped offering them: ${emptyCases
        .map((c) => `${c.key} (${c.stockQuantity})`)
        .join(", ")}`,
    );
  }
  console.log(
    `Cases: ${cases.map((c) => `${c.key}=${c.stockQuantity}`).join("  ")}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
