/**
 * Weekly cron: deletes tracking_events older than 90 days.
 * daily_analytics are kept indefinitely.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  console.log(`Cleaning up events older than ${cutoff.toISOString()}`);

  const deleted = await prisma.trackingEvent.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });

  console.log(`Deleted ${deleted.count} old tracking events`);

  // Also clean up orphan sessions (no events, older than 90 days)
  const deletedSessions = await prisma.session.deleteMany({
    where: {
      landedAt: { lt: cutoff },
      events: { none: {} },
    },
  });

  console.log(`Deleted ${deletedSessions.count} orphan sessions`);
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
