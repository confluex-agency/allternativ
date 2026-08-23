// Which sold-out colourways people are still asking for.
//
//   npm run demand
//   npm run demand -- 90        (a different window, in days)
//
// The client's reason for keeping sold-out variants on the page was to learn
// "qué productos siguen teniendo demanda incluso estando agotados". Collecting
// the event is half of that; being able to read it is the other half, and
// without this script the answer would sit in a table nobody opens. The proper
// home is a screen in the admin, which comes with the analytics phase.
//
// ⚠️ These are CONSENTING visitors only. Every number here is a floor, never a
// total, and the useful reading is the comparison between rows rather than any
// single figure: "Olive is wanted three times as often as Black" survives the
// undercount, "42 people wanted Olive" does not.

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

type Meta = { productSlug?: string; sku?: string; colorName?: string };

async function main() {
  const days = Number(process.argv[2] ?? 30) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const events = await prisma.trackingEvent.findMany({
    where: { eventType: "sold_out_view", timestamp: { gte: since } },
    select: { metadata: true, sessionId: true },
  });

  if (events.length === 0) {
    console.log(`No sold-out interest recorded in the last ${days} days.`);
    console.log(
      "That is either good news (nothing has run out) or a reminder that\n" +
        "only consenting visitors are counted.",
    );
    await prisma.$disconnect();
    return;
  }

  // Grouped by SKU, and counting SESSIONS rather than clicks: somebody
  // clicking the same sold-out swatch four times is one person wanting it
  // once, and counting clicks would let a single frustrated visitor outvote a
  // colourway ten people asked for.
  const bySku = new Map<
    string,
    { label: string; sessions: Set<string>; clicks: number }
  >();

  for (const event of events) {
    const meta = (event.metadata ?? {}) as Meta;
    const sku = meta.sku ?? "unknown";
    const label = `${meta.productSlug ?? "?"} · ${meta.colorName ?? "?"}`;
    const row = bySku.get(sku) ?? { label, sessions: new Set(), clicks: 0 };
    row.sessions.add(event.sessionId);
    row.clicks += 1;
    bySku.set(sku, row);
  }

  const rows = [...bySku.entries()]
    .map(([sku, r]) => ({ sku, label: r.label, people: r.sessions.size, clicks: r.clicks }))
    .sort((a, b) => b.people - a.people);

  console.log(`Sold-out colourways people still asked for, last ${days} days\n`);
  console.log("  people  clicks  colourway");
  for (const row of rows) {
    console.log(
      `  ${String(row.people).padStart(6)}  ${String(row.clicks).padStart(6)}  ${row.label}`,
    );
    console.log(`                  ${row.sku}`);
  }
  console.log(
    `\nConsenting visitors only. Compare the rows, not the totals.`,
  );

  await prisma.$disconnect();
}

main();
