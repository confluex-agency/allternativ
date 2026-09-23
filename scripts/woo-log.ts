// Read-only: what the supplier's system asked the WooCommerce facade for.
// Usage: DATABASE_URL=<staging url> npx tsx scripts/woo-log.ts
// dotenv never overrides a variable already set, so the DATABASE_URL passed on
// the command line wins and the rest (JWT_SECRET and friends) comes from .env.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("total rows:", await prisma.wooRequestLog.count());
  const odd = await prisma.wooRequestLog.findMany({
    where: { OR: [{ method: { not: "GET" } }, { matched: false }] },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  for (const r of odd) console.log(JSON.stringify(r));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
