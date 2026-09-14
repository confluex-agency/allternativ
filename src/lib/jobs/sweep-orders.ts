/**
 * Housekeeping for the payment path. Safe to run as often as you like.
 *
 * Eight jobs:
 *
 * 1. Hand expired stock reservations back. Abandoned checkouts release
 *    themselves on the next purchase attempt anyway, but a shop with no traffic
 *    would otherwise sit on locked stock until someone tried to buy.
 *
 * 2. Retry webhook events that failed for a transient reason. Stripe retries on
 *    its own for three days; this covers what is left after that, and gives a
 *    way to push a stuck event through by hand.
 *
 * 3. Drain the confirmation-email queue. The webhook must answer Stripe in
 *    milliseconds and a mail provider cannot be trusted to take milliseconds,
 *    so the order is written there and the mail is queued on it.
 *
 * 4. Drain the dispatch-notification queue. Same shape, different trigger: this
 *    one becomes due when the supplier's ERP marks an order shipped and writes
 *    a tracking number, not when the order is created.
 *
 * 5. Drain the account-verification queue. Same shape again, and the one with
 *    teeth: until that link is clicked a customer cannot see their own order
 *    history, because a `Customer` row is created by the Stripe webhook for
 *    every guest buyer and an unproven address must not open one.
 *
 * 6. Drain the password-reset queue. ⚠️ The one where being late is itself the
 *    failure: a reset link is worth a few hours, so a sweep that does not run
 *    does not merely delay this mail, it makes it worthless. The drain refuses
 *    to post a link that has already expired.
 *
 * 7. Drain the admin-invitation queue. The one whose message is worth the
 *    most: it grants staff access that did not exist before, with a role
 *    attached.
 *
 * 8. Drain the admin password-reset queue. Told apart from the invitation by
 *    the thing the two messages differ on: this one goes to a row that already
 *    HAS a password. Without it, an admin who forgot theirs had no way back at
 *    all.
 *
 * Events marked FAILED by an UnprocessableEventError are NOT retried here: they
 * are broken in a way that time does not fix. They stay in the table with their
 * reason, which is the point of keeping the table.
 */
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { processStripeEvent } from "@/lib/webhooks/process-stripe-event";
// The shared one, deliberately: this job used to carry its own copy, which then
// quietly failed to hand cases back when case stock was introduced.
import { releaseExpiredReservations } from "@/lib/inventory";
import {
  buildOrderConfirmation,
  buildDispatchNotification,
  buildEmailVerification,
  buildPasswordReset,
  buildAdminInvitation,
  buildAdminPasswordReset,
  sendEmail,
  outcomeForFailure,
  EMAIL_MAX_ATTEMPTS,
} from "@/lib/email";
import type { JobResult } from "@/lib/jobs/types";

/** Older than this and a failed event is not worth retrying automatically. */
const RETRY_WINDOW_HOURS = 72;
const MAX_ATTEMPTS = 10;

async function retryFailedEvents(): Promise<{
  ok: number;
  stillFailing: number;
}> {
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

/**
 * Drain the dispatch-notification queue.
 *
 * ⚠️ The condition is what makes this correct, and it is not `status = PENDING`.
 * Every order carries `dispatchEmailStatus = PENDING` from the moment it is
 * paid, and most of them sit there legitimately for days — the mail is not
 * late, it has not happened yet. What makes one DUE is the order having shipped
 * **and** carrying a tracking number.
 *
 * Requiring the number and not just the status is deliberate: the supplier's
 * ERP writes `SHIPPED` and the tracking number in the same update today, but a
 * status arriving without a number would otherwise mail the buyer a "here is
 * your tracking" with nothing in it, which is worse than saying nothing at all.
 */
async function drainDispatchEmails(): Promise<{
  sent: number;
  retrying: number;
  gaveUp: number;
  blocked: string | null;
}> {
  const queued = await prisma.order.findMany({
    where: {
      dispatchEmailStatus: "PENDING",
      status: { in: ["SHIPPED", "DELIVERED"] },
      trackingNumber: { not: null },
      dispatchEmailAttempts: { lt: EMAIL_MAX_ATTEMPTS },
    },
    orderBy: { shippedAt: "asc" },
    take: 50,
    include: { customer: true, items: true },
  });

  let sent = 0;
  let retrying = 0;
  let gaveUp = 0;
  let blocked: string | null = null;

  for (const order of queued) {
    if (!order.customer?.email) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          dispatchEmailStatus: "FAILED",
          dispatchEmailLastError: "Order has no customer email",
        },
      });
      gaveUp++;
      continue;
    }

    try {
      await sendEmail(buildDispatchNotification(order.customer.email, order));
      await prisma.order.update({
        where: { id: order.id },
        data: {
          dispatchEmailStatus: "SENT",
          dispatchEmailSentAt: new Date(),
          dispatchEmailAttempts: { increment: 1 },
          dispatchEmailLastError: null,
        },
      });
      sent++;
    } catch (error) {
      const outcome = outcomeForFailure(order.dispatchEmailAttempts, error);

      if (outcome.kind === "keep") {
        blocked = outcome.reason;
        break;
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          dispatchEmailStatus: outcome.kind === "giveUp" ? "FAILED" : "PENDING",
          dispatchEmailAttempts: outcome.attempts,
          dispatchEmailLastError: outcome.error,
        },
      });
      if (outcome.kind === "giveUp") gaveUp++;
      else retrying++;
    }
  }

  return { sent, retrying, gaveUp, blocked };
}

/**
 * Drain the account-verification queue.
 *
 * ⚠️ The condition is a token and an unproven address, NOT a status. Clearing
 * the token is what `consumeVerificationToken` does when somebody clicks the
 * link, so a verified account drops out of this query whatever its status
 * column says — and an account that verified while the queue was blocked never
 * gets mailed a link it no longer needs.
 *
 * An expired token is not re-issued here. Doing that would mail somebody a
 * fresh link out of nowhere, days after they lost interest; asking for another
 * one is a button on the account page.
 */
async function drainVerificationEmails(): Promise<{
  sent: number;
  retrying: number;
  gaveUp: number;
  blocked: string | null;
}> {
  const queued = await prisma.customer.findMany({
    where: {
      verifyEmailStatus: "PENDING",
      emailVerifiedAt: null,
      emailVerificationToken: { not: null },
      emailVerificationExpiresAt: { gt: new Date() },
      verifyEmailAttempts: { lt: EMAIL_MAX_ATTEMPTS },
    },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: {
      id: true,
      email: true,
      name: true,
      emailVerificationToken: true,
      emailVerificationExpiresAt: true,
      verifyEmailAttempts: true,
    },
  });

  let sent = 0;
  let retrying = 0;
  let gaveUp = 0;
  let blocked: string | null = null;

  for (const customer of queued) {
    try {
      await sendEmail(
        buildEmailVerification(customer.email, {
          name: customer.name,
          token: customer.emailVerificationToken!,
          expiresAt: customer.emailVerificationExpiresAt!,
        }),
      );
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          verifyEmailStatus: "SENT",
          verifyEmailSentAt: new Date(),
          verifyEmailAttempts: { increment: 1 },
          verifyEmailLastError: null,
        },
      });
      sent++;
    } catch (error) {
      const outcome = outcomeForFailure(customer.verifyEmailAttempts, error);

      if (outcome.kind === "keep") {
        blocked = outcome.reason;
        break;
      }

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          verifyEmailStatus: outcome.kind === "giveUp" ? "FAILED" : "PENDING",
          verifyEmailAttempts: outcome.attempts,
          verifyEmailLastError: outcome.error,
        },
      });
      if (outcome.kind === "giveUp") gaveUp++;
      else retrying++;
    }
  }

  return { sent, retrying, gaveUp, blocked };
}

/**
 * Drain the password-reset queue.
 *
 * ⚠️ **This queue is the one where lateness is itself the failure.** The other
 * three carry messages that are still correct a day late; a reset link is
 * valid for a few hours from the moment it is minted, so a sweep that
 * does not run posts a link that arrives dead. That is why the expiry is in the
 * query — a link already past its time is never sent, because "here is your
 * reset link" followed by "this link has expired" is worse than nothing and
 * reads to the customer as a shop that does not work.
 *
 * Like the verification drain, the condition is the token rather than the
 * status alone: a reset that has been used clears its token and drops out,
 * whatever the column says.
 */
async function drainPasswordResetEmails(): Promise<{
  sent: number;
  retrying: number;
  gaveUp: number;
  blocked: string | null;
}> {
  const queued = await prisma.customer.findMany({
    where: {
      resetEmailStatus: "PENDING",
      passwordResetToken: { not: null },
      passwordResetExpiresAt: { gt: new Date() },
      resetEmailAttempts: { lt: EMAIL_MAX_ATTEMPTS },
    },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: {
      id: true,
      email: true,
      name: true,
      passwordResetToken: true,
      passwordResetExpiresAt: true,
      resetEmailAttempts: true,
    },
  });

  let sent = 0;
  let retrying = 0;
  let gaveUp = 0;
  let blocked: string | null = null;

  for (const customer of queued) {
    try {
      await sendEmail(
        buildPasswordReset(customer.email, {
          name: customer.name,
          token: customer.passwordResetToken!,
          expiresAt: customer.passwordResetExpiresAt!,
        }),
      );
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          resetEmailStatus: "SENT",
          resetEmailSentAt: new Date(),
          resetEmailAttempts: { increment: 1 },
          resetEmailLastError: null,
        },
      });
      sent++;
    } catch (error) {
      const outcome = outcomeForFailure(customer.resetEmailAttempts, error);

      if (outcome.kind === "keep") {
        blocked = outcome.reason;
        break;
      }

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          resetEmailStatus: outcome.kind === "giveUp" ? "FAILED" : "PENDING",
          resetEmailAttempts: outcome.attempts,
          resetEmailLastError: outcome.error,
        },
      });
      if (outcome.kind === "giveUp") gaveUp++;
      else retrying++;
    }
  }

  return { sent, retrying, gaveUp, blocked };
}

/**
 * Drain the admin-invitation queue.
 *
 * ⚠️ The only queue here that is not about a customer, and the one whose
 * message is worth the most: an invitation grants staff access that did not
 * exist before, with a role attached.
 *
 * Same shape as the others — token present, not expired, PENDING — and the
 * expiry is in the query for the reason the reset drain has it: a link posted
 * after it died is worse than one never sent, because the recipient sees a
 * broken company rather than nothing at all.
 */
async function drainAdminInviteEmails(): Promise<{
  sent: number;
  retrying: number;
  gaveUp: number;
  blocked: string | null;
}> {
  const queued = await prisma.adminUser.findMany({
    where: {
      inviteEmailStatus: "PENDING",
      isActive: true,
      passwordHash: null,
      inviteToken: { not: null },
      inviteExpiresAt: { gt: new Date() },
      inviteEmailAttempts: { lt: EMAIL_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      invitedByEmail: true,
      inviteToken: true,
      inviteExpiresAt: true,
      inviteEmailAttempts: true,
    },
  });

  let sent = 0;
  let retrying = 0;
  let gaveUp = 0;
  let blocked: string | null = null;

  for (const admin of queued) {
    try {
      await sendEmail(
        buildAdminInvitation(admin.email, {
          name: admin.name,
          role: admin.role,
          invitedByEmail: admin.invitedByEmail,
          token: admin.inviteToken!,
          expiresAt: admin.inviteExpiresAt!,
        }),
      );
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          inviteEmailStatus: "SENT",
          inviteEmailSentAt: new Date(),
          inviteEmailAttempts: { increment: 1 },
          inviteEmailLastError: null,
        },
      });
      sent++;
    } catch (error) {
      const outcome = outcomeForFailure(admin.inviteEmailAttempts, error);

      if (outcome.kind === "keep") {
        blocked = outcome.reason;
        break;
      }

      await prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          inviteEmailStatus: outcome.kind === "giveUp" ? "FAILED" : "PENDING",
          inviteEmailAttempts: outcome.attempts,
          inviteEmailLastError: outcome.error,
        },
      });
      if (outcome.kind === "giveUp") gaveUp++;
      else retrying++;
    }
  }

  return { sent, retrying, gaveUp, blocked };
}

/**
 * Drain the admin password-reset queue.
 *
 * The staff twin of `drainPasswordResetEmails`, and told apart from the
 * invitation queue by the same thing the two messages are: this one goes to a
 * row that HAS a password. The condition matters — an invitation drain that
 * picked these up would mail a working admin "you now have access".
 */
async function drainAdminResetEmails(): Promise<{
  sent: number;
  retrying: number;
  gaveUp: number;
  blocked: string | null;
}> {
  const queued = await prisma.adminUser.findMany({
    where: {
      resetEmailStatus: "PENDING",
      isActive: true,
      passwordHash: { not: null },
      passwordResetToken: { not: null },
      passwordResetExpiresAt: { gt: new Date() },
      resetEmailAttempts: { lt: EMAIL_MAX_ATTEMPTS },
    },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: {
      id: true,
      email: true,
      name: true,
      passwordResetToken: true,
      passwordResetExpiresAt: true,
      resetEmailAttempts: true,
    },
  });

  let sent = 0;
  let retrying = 0;
  let gaveUp = 0;
  let blocked: string | null = null;

  for (const admin of queued) {
    try {
      await sendEmail(
        buildAdminPasswordReset(admin.email, {
          name: admin.name,
          token: admin.passwordResetToken!,
          expiresAt: admin.passwordResetExpiresAt!,
        }),
      );
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          resetEmailStatus: "SENT",
          resetEmailSentAt: new Date(),
          resetEmailAttempts: { increment: 1 },
          resetEmailLastError: null,
        },
      });
      sent++;
    } catch (error) {
      const outcome = outcomeForFailure(admin.resetEmailAttempts, error);
      if (outcome.kind === "keep") {
        blocked = outcome.reason;
        break;
      }
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          resetEmailStatus: outcome.kind === "giveUp" ? "FAILED" : "PENDING",
          resetEmailAttempts: outcome.attempts,
          resetEmailLastError: outcome.error,
        },
      });
      if (outcome.kind === "giveUp") gaveUp++;
      else retrying++;
    }
  }

  return { sent, retrying, gaveUp, blocked };
}

export async function sweepOrders(): Promise<JobResult> {
  const warnings: string[] = [];

  const released = await releaseExpiredReservations();
  const { ok, stillFailing } = await retryFailedEvents();
  const mail = await drainOrderEmails();
  const dispatch = await drainDispatchEmails();
  const verify = await drainVerificationEmails();
  const reset = await drainPasswordResetEmails();
  const invites = await drainAdminInviteEmails();
  const adminResets = await drainAdminResetEmails();

  // Said once even when all six queues are stuck, because they stall for the
  // same single reason — no provider — and saying it six times would read as
  // six faults.
  const blocked =
    mail.blocked ??
    dispatch.blocked ??
    verify.blocked ??
    reset.blocked ??
    invites.blocked ??
    adminResets.blocked;
  if (blocked) {
    warnings.push(`Email queue is not draining: ${blocked}`);
  }
  if (mail.gaveUp > 0) {
    warnings.push(
      `${mail.gaveUp} order(s) will never be confirmed by email. The success ` +
        `page promised the buyer one, so somebody has to write to them by hand.`,
    );
  }
  if (dispatch.gaveUp > 0) {
    warnings.push(
      `${dispatch.gaveUp} order(s) shipped without the buyer being told. The ` +
        `confirmation email promised them tracking, so somebody has to send it ` +
        `by hand.`,
    );
  }

  if (verify.gaveUp > 0) {
    warnings.push(
      `${verify.gaveUp} account(s) could not be sent a verification link. ` +
        `Those people can sign in but will never see their own order history ` +
        `until somebody sorts the address out.`,
    );
  }

  if (adminResets.gaveUp > 0) {
    warnings.push(
      `${adminResets.gaveUp} admin password reset(s) could not be emailed. ` +
        `Somebody on the team is locked out of the admin right now.`,
    );
  }

  if (invites.gaveUp > 0) {
    warnings.push(
      `${invites.gaveUp} admin invitation(s) could not be emailed. Those ` +
        `people have a staff account they cannot reach, and somebody is ` +
        `waiting on them.`,
    );
  }

  if (reset.gaveUp > 0) {
    warnings.push(
      `${reset.gaveUp} password reset(s) could not be emailed. Those people ` +
        `asked to get back into their account and were not answered.`,
    );
  }

  // ⚠️ Unlike the other three backlogs, this one is measured against the CLOCK
  // and not only against the queue. A reset link is worth a few hours, so a
  // reset still sitting here unsent is burning a window that does not refill —
  // and once it expires it leaves the queue silently, with the person still
  // waiting and nothing anywhere saying so. Counting it while it is still alive
  // is the only moment there is anything to count.
  const waitingForReset = await prisma.customer.count({
    where: {
      resetEmailStatus: "PENDING",
      passwordResetToken: { not: null },
      passwordResetExpiresAt: { gt: new Date() },
    },
  });
  if (waitingForReset > 0) {
    warnings.push(
      `${waitingForReset} password reset link(s) still unsent, and they expire ` +
        `in a few hours. If the sweep is late these people get nothing.`,
    );
  }

  // The backlog that is quietest and least obvious from the outside: these
  // people registered, were told to check their email, and nothing was sent.
  const unverified = await prisma.customer.count({
    where: {
      verifyEmailStatus: "PENDING",
      emailVerifiedAt: null,
      emailVerificationToken: { not: null },
      emailVerificationExpiresAt: { gt: new Date() },
    },
  });
  if (unverified > 0) {
    warnings.push(
      `${unverified} account(s) still waiting for a verification email. ` +
        `Their order history stays hidden until they get it.`,
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
    warnings.push(
      `${unconfirmed} paid order(s) still waiting for a confirmation email.`,
    );
  }

  // The same backlog check for the other queue, and it is the more embarrassing
  // one: the parcel is already moving and the buyer does not know.
  const untold = await prisma.order.count({
    where: {
      dispatchEmailStatus: "PENDING",
      status: { in: ["SHIPPED", "DELIVERED"] },
      trackingNumber: { not: null },
    },
  });
  if (untold > 0) {
    warnings.push(
      `${untold} shipped order(s) still waiting for their tracking email.`,
    );
  }

  // Anything sitting here needs a person, so say so loudly rather than
  // finishing quietly as if all were well.
  const stuck = await prisma.webhookEvent.count({ where: { status: "FAILED" } });
  if (stuck > 0) {
    warnings.push(
      `${stuck} webhook event(s) still failed. Inspect webhook_events.`,
    );
  }

  const negative = await prisma.productVariant.findMany({
    where: { stockQuantity: { lt: 0 } },
    select: { sku: true, stockQuantity: true },
  });
  if (negative.length > 0) {
    warnings.push(
      `Negative stock, sold more than held: ${negative
        .map((v) => `${v.sku} (${v.stockQuantity})`)
        .join(", ")}`,
    );
  }

  const cases = await prisma.caseStock.findMany({ orderBy: { key: "asc" } });
  const emptyCases = cases.filter((c) => c.stockQuantity <= 0 && c.isActive);
  if (emptyCases.length > 0) {
    warnings.push(
      `Cases out of stock, the shop has stopped offering them: ${emptyCases
        .map((c) => `${c.key} (${c.stockQuantity})`)
        .join(", ")}`,
    );
  }

  return {
    summary: {
      reservationsReleased: released,
      webhookEventsRecovered: ok,
      webhookEventsStillFailing: stillFailing,
      emailsSent: mail.sent,
      emailsRetrying: mail.retrying,
      emailsGivenUp: mail.gaveUp,
      dispatchEmailsSent: dispatch.sent,
      dispatchEmailsRetrying: dispatch.retrying,
      dispatchEmailsGivenUp: dispatch.gaveUp,
      verificationEmailsSent: verify.sent,
      verificationEmailsRetrying: verify.retrying,
      verificationEmailsGivenUp: verify.gaveUp,
      resetEmailsSent: reset.sent,
      resetEmailsRetrying: reset.retrying,
      resetEmailsGivenUp: reset.gaveUp,
      adminInvitesSent: invites.sent,
      adminInvitesRetrying: invites.retrying,
      adminInvitesGivenUp: invites.gaveUp,
      adminResetsSent: adminResets.sent,
      adminResetsRetrying: adminResets.retrying,
      adminResetsGivenUp: adminResets.gaveUp,
      cases: cases.map((c) => `${c.key}=${c.stockQuantity}`).join("  "),
    },
    warnings,
  };
}
