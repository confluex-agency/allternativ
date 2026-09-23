/**
 * Deletes tracking events older than 90 days, weekly.
 *
 * `daily_analytics` is kept indefinitely — it is the aggregate, it is small,
 * and it is the only long record of how the shop performed. What goes is the
 * raw material it was built from, which on a shared plan grows without limit.
 */
import { prisma } from "@/lib/prisma";
import { purgeOldContactMessages } from "@/lib/contact";
import { purgeUnconfirmedSubscribers } from "@/lib/newsletter";
import type { JobResult } from "@/lib/jobs/types";

const RETENTION_DAYS = 90;

export async function cleanupOldEvents(): Promise<JobResult> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const deleted = await prisma.trackingEvent.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });

  // Sessions that outlived their events. Kept in step with the same cutoff so
  // the two tables cannot drift into a state where a session has a page count
  // but nothing to back it up.
  const deletedSessions = await prisma.session.deleteMany({
    where: {
      landedAt: { lt: cutoff },
      events: { none: {} },
    },
  });

  // A different clock and a different reason: contact messages are personal
  // data kept to answer somebody, and the privacy page says for how long.
  const contactMessagesDeleted = await purgeOldContactMessages();

  // Addresses typed into the footer and never confirmed. Nobody proved they
  // own them, so there is no reason to keep them. See `newsletter.ts`.
  const unconfirmedSubscribersDeleted = await purgeUnconfirmedSubscribers();

  return {
    summary: {
      olderThan: cutoff.toISOString(),
      eventsDeleted: deleted.count,
      orphanSessionsDeleted: deletedSessions.count,
      contactMessagesDeleted,
      unconfirmedSubscribersDeleted,
    },
    warnings: [],
  };
}
