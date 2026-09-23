/**
 * The newsletter list: who asked to hear from us, and the proof that they did.
 *
 * Point D4 of the client's answer of 2026-09-21, "closed for launch": capture
 * consent from day one, without building campaigns yet. So this file records
 * consent and nothing else. Nothing here sends a marketing email.
 *
 * ── Two doors, and why they are not treated alike ───────────────────────────
 *
 * - **The footer** takes any address anybody types. It is DOUBLE opt-in: the
 *   row is PENDING until the link mailed to that address is clicked. Without
 *   that, anyone can subscribe anyone, and the day a campaign goes out it goes
 *   to people we have no record of having asked, which under the GDPR is our
 *   problem to prove, not theirs.
 * - **The checkout** checkbox is recorded straight away, as SUBSCRIBED. The
 *   address is the one the order confirmation is sent to, and the tick was
 *   given in the same act as a payment. Asking a buyer to confirm again, in a
 *   second mail beside their receipt, is friction with no proof added.
 *
 * ⚠️ `Customer.marketingConsent` is a second, older switch (the account page
 * sets it) and it is NOT this list. Whoever builds the first campaign must
 * read both, or decide to fold one into the other. They were not merged here
 * because merging means choosing which one wins when they disagree, and that
 * is a decision for the person who sends, not for the person who collects.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildNewsletterConfirmation,
  sendEmail,
  outcomeForFailure,
  EMAIL_MAX_ATTEMPTS,
} from "@/lib/email";

/**
 * How long a confirmation link lives.
 *
 * Long, because it is the weakest link in the shop: the worst a stolen one
 * does is subscribe the owner of the mailbox it was sent to. It has to survive
 * a spam folder and "I'll look at it this weekend".
 */
export const NEWSLETTER_CONFIRM_TTL_DAYS = 7;

/**
 * An address that never confirmed is deleted after this many days.
 *
 * It was typed by somebody who may not own it, and it was never proven. Keeping
 * it would be holding a stranger's address for no purpose, which is exactly
 * what data minimisation forbids.
 */
export const NEWSLETTER_PENDING_RETENTION_DAYS = 30;

export const NewsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(191)
    .email("That email address does not look right"),
  // Honeypot, as on the contact form.
  website: z.string().max(200).optional(),
});

function mintToken() {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(
      Date.now() + NEWSLETTER_CONFIRM_TTL_DAYS * 24 * 60 * 60 * 1000,
    ),
  };
}

/**
 * The footer's half: queue a confirmation mail, then try it once.
 *
 * ⚠️ The route answers the same thing whatever this returns. "Already on the
 * list" versus "check your inbox" would tell anybody whether a given address
 * is subscribed, which is nobody's business but its owner's.
 *
 * An address that is already SUBSCRIBED gets no mail: there is nothing to
 * confirm, and a second "confirm?" would read as if something had changed.
 * An UNSUBSCRIBED one keeps that status until the link is clicked, so a
 * stranger typing it in cannot put somebody back on the list.
 */
export async function requestSubscription(input: {
  email: string;
  ipHash: string | null;
}): Promise<{ mailed: boolean }> {
  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email: input.email },
    select: { status: true },
  });
  if (existing?.status === "SUBSCRIBED") return { mailed: false };

  // A newer request kills the older link, like a password reset.
  const { token, expiresAt } = mintToken();
  const queue = {
    confirmToken: token,
    confirmExpiresAt: expiresAt,
    confirmEmailStatus: "PENDING" as const,
    confirmEmailAttempts: 0,
    confirmEmailLastError: null,
    consentIpHash: input.ipHash,
  };

  const row = await prisma.newsletterSubscriber.upsert({
    where: { email: input.email },
    update: queue,
    create: {
      email: input.email,
      status: "PENDING",
      source: "footer",
      unsubscribeToken: randomBytes(32).toString("base64url"),
      ...queue,
    },
  });

  const result = await deliverConfirmation(row);
  return { mailed: result.kind === "sent" };
}

/**
 * The checkout's half, run INSIDE the webhook's transaction so the consent and
 * the order it came with are written together or not at all.
 *
 * Only ever called when the buyer ticked the box. An existing row is moved to
 * SUBSCRIBED even if it had unsubscribed: ticking an unticked box is as
 * explicit as consent gets, and it is newer than the unsubscription.
 */
export async function recordCheckoutConsent(
  tx: Prisma.TransactionClient,
  email: string,
): Promise<void> {
  const now = new Date();
  const subscribed = {
    status: "SUBSCRIBED" as const,
    consentAt: now,
    confirmedAt: now,
    unsubscribedAt: null,
    // A pending footer link is now pointless. Left alive it would do nothing
    // harmful, but a mail still in the queue would ask somebody to confirm what
    // they have just confirmed.
    confirmToken: null,
    confirmExpiresAt: null,
    confirmEmailStatus: "SKIPPED" as const,
  };
  await tx.newsletterSubscriber.upsert({
    where: { email: email.trim().toLowerCase() },
    update: subscribed,
    create: {
      email: email.trim().toLowerCase(),
      source: "checkout",
      unsubscribeToken: randomBytes(32).toString("base64url"),
      ...subscribed,
    },
  });
}

export type ConfirmResult = "confirmed" | "invalid" | "expired";

/**
 * Spend a confirmation link. The token is cleared in the same write that
 * records the consent, so a link works once.
 *
 * ⚠️ Called from a POST, never from the page load: a mail scanner or a link
 * preview issues a GET, and would subscribe people who never clicked.
 */
export async function confirmSubscription(token: string): Promise<ConfirmResult> {
  if (!token) return "invalid";
  const row = await prisma.newsletterSubscriber.findUnique({
    where: { confirmToken: token },
    select: { id: true, confirmExpiresAt: true, confirmEmailStatus: true },
  });
  if (!row) return "invalid";
  if (row.confirmExpiresAt && row.confirmExpiresAt.getTime() < Date.now()) {
    return "expired";
  }
  const now = new Date();
  await prisma.newsletterSubscriber.update({
    where: { id: row.id },
    data: {
      status: "SUBSCRIBED",
      // Consent is given by the click, not by the typing.
      consentAt: now,
      confirmedAt: now,
      unsubscribedAt: null,
      confirmToken: null,
      confirmExpiresAt: null,
      // Clicked before the queue caught up (seen in the first browser test:
      // the link was used while the mail was still waiting for a provider).
      // Nothing left to send.
      ...(row.confirmEmailStatus === "PENDING"
        ? { confirmEmailStatus: "SKIPPED" as const }
        : {}),
    },
  });
  return "confirmed";
}

/**
 * Leave the list. Idempotent on purpose: the privacy page promises a link that
 * "works immediately", and a second click on the same link must not answer
 * with an error that makes the person wonder whether the first one worked.
 *
 * The row is kept, as UNSUBSCRIBED. It is the record that this address said
 * no, which is what stops it being added back by accident.
 */
export async function unsubscribe(token: string): Promise<boolean> {
  if (!token) return false;
  const row = await prisma.newsletterSubscriber.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, status: true },
  });
  if (!row) return false;
  if (row.status !== "UNSUBSCRIBED") {
    await prisma.newsletterSubscriber.update({
      where: { id: row.id },
      data: {
        status: "UNSUBSCRIBED",
        unsubscribedAt: new Date(),
        confirmToken: null,
        confirmExpiresAt: null,
        confirmEmailStatus: "SKIPPED",
      },
    });
  }
  return true;
}

type QueuedRow = {
  id: string;
  email: string;
  confirmToken: string | null;
  confirmExpiresAt: Date | null;
  confirmEmailAttempts: number;
};

type Delivery =
  | { kind: "sent" }
  | { kind: "retrying" }
  | { kind: "gaveUp" }
  | { kind: "skipped" }
  | { kind: "blocked"; reason: string };

/** One attempt, shared by the route and the sweep. Same states as `contact.ts`. */
async function deliverConfirmation(row: QueuedRow): Promise<Delivery> {
  // A link that already expired in the queue is not worth posting: "confirm
  // here" followed by "this link has expired" reads as a shop that is broken.
  if (
    !row.confirmToken ||
    !row.confirmExpiresAt ||
    row.confirmExpiresAt.getTime() < Date.now()
  ) {
    await prisma.newsletterSubscriber.update({
      where: { id: row.id },
      data: { confirmEmailStatus: "SKIPPED" },
    });
    return { kind: "skipped" };
  }

  try {
    await sendEmail(
      buildNewsletterConfirmation(row.email, {
        token: row.confirmToken,
        expiresAt: row.confirmExpiresAt,
      }),
    );
    await prisma.newsletterSubscriber.update({
      where: { id: row.id },
      data: {
        confirmEmailStatus: "SENT",
        confirmEmailSentAt: new Date(),
        confirmEmailAttempts: { increment: 1 },
        confirmEmailLastError: null,
      },
    });
    return { kind: "sent" };
  } catch (error) {
    const outcome = outcomeForFailure(row.confirmEmailAttempts, error);
    if (outcome.kind === "keep") return { kind: "blocked", reason: outcome.reason };
    await prisma.newsletterSubscriber.update({
      where: { id: row.id },
      data: {
        confirmEmailStatus: outcome.kind === "giveUp" ? "FAILED" : "PENDING",
        confirmEmailAttempts: outcome.attempts,
        confirmEmailLastError: outcome.error,
      },
    });
    return { kind: outcome.kind === "giveUp" ? "gaveUp" : "retrying" };
  }
}

/** The sweep's half: every confirmation still queued, oldest first. */
export async function drainNewsletterConfirmations(): Promise<{
  sent: number;
  retrying: number;
  gaveUp: number;
  blocked: string | null;
}> {
  const queued = await prisma.newsletterSubscriber.findMany({
    where: {
      confirmEmailStatus: "PENDING",
      confirmEmailAttempts: { lt: EMAIL_MAX_ATTEMPTS },
    },
    orderBy: { updatedAt: "asc" },
    take: 50,
  });

  let sent = 0;
  let retrying = 0;
  let gaveUp = 0;
  let blocked: string | null = null;
  for (const row of queued) {
    const result = await deliverConfirmation(row);
    if (result.kind === "blocked") {
      blocked = result.reason;
      break;
    }
    if (result.kind === "sent") sent++;
    else if (result.kind === "gaveUp") gaveUp++;
    else if (result.kind === "retrying") retrying++;
  }
  return { sent, retrying, gaveUp, blocked };
}

/**
 * Deletes addresses that were typed in and never confirmed. Run by the weekly
 * cleanup.
 *
 * ⚠️ Only rows that were NEVER on the list: no confirmation and no
 * unsubscription. An UNSUBSCRIBED row that a stranger later typed back in is
 * kept, because it is the record of somebody having said no.
 */
export async function purgeUnconfirmedSubscribers(): Promise<number> {
  const cutoff = new Date(
    Date.now() - NEWSLETTER_PENDING_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const { count } = await prisma.newsletterSubscriber.deleteMany({
    where: {
      status: "PENDING",
      confirmedAt: null,
      unsubscribedAt: null,
      createdAt: { lt: cutoff },
    },
  });
  return count;
}
