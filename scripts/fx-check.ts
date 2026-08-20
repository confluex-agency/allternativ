/**
 * Is the frozen exchange rate still close enough to reality?
 *
 *   npm run fx:check
 *
 * Delivery is charged at the supplier's cost with no markup, and the supplier
 * quotes in dollars while the shop charges in euros. The rate used for that
 * conversion is frozen in `src/lib/shipping.ts` on purpose, so the price does
 * not wobble between the cart and the payment page. The cost of freezing it is
 * that the dollar keeps moving and the price does not, and somebody has to
 * notice. That somebody is this script.
 *
 * ⚠️ It changes nothing. It reports, and a human edits `FX` deliberately.
 *
 * ── Why it weighs the drift by real orders ──────────────────────────────────
 * "The euro moved 8%" is not a decision. Losing 95 cents a parcel to Malta
 * means nothing if nobody in Malta has ever ordered. What decides whether the
 * table is worth re-freezing is what the drift actually cost across the orders
 * that shipped, so that is the headline figure.
 *
 * There is no markup absorbing any of this: the client asked for cost with no
 * cushion, so every cent of drift lands on the bottom line.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  FX,
  SUPPLIER_SHIPPING_USD,
  supplierCostUsdCents,
  FREE_SHIPPING_FROM_PAIRS,
} from "../src/lib/shipping";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

/** Above this, the table is worth re-freezing. Below it, this is noise. */
const DRIFT_ALERT_PERCENT = 5;

/** How far back to look for orders. */
const WINDOW_DAYS = Number(process.env.FX_WINDOW_DAYS ?? 90);

const money = (cents: number, currency: string) =>
  `${(cents / 100).toFixed(2)} ${currency}`;

async function spotRates(): Promise<Record<string, number> | null> {
  const symbols = Object.keys(FX.perUsd)
    .filter((c) => c !== "USD")
    .join(",");
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbols}`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { rates: Record<string, number> };
    return { ...body.rates, USD: 1 };
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Frozen on ${FX.date}, from ${FX.source}\n`);

  const spot = await spotRates();
  if (!spot) {
    console.error(
      "Could not reach the rate provider. Nothing was changed; try again later.",
    );
    process.exit(1);
  }

  // ── 1. How far each currency has moved ──────────────────────────────────
  console.log("RATE DRIFT");
  let worst = 0;
  for (const [currency, frozen] of Object.entries(FX.perUsd)) {
    const now = spot[currency];
    if (now === undefined || currency === "USD") continue;
    // Positive means the dollar buys more of this currency than when we froze,
    // so the supplier's invoice converts to MORE than we are charging.
    const drift = ((now - frozen) / frozen) * 100;
    worst = Math.max(worst, Math.abs(drift));
    const flag = Math.abs(drift) >= DRIFT_ALERT_PERCENT ? "  ← review" : "";
    console.log(
      `  ${currency}  frozen ${frozen.toFixed(5)}  now ${now.toFixed(5)}  ` +
        `${drift >= 0 ? "+" : ""}${drift.toFixed(2)}%${flag}`,
    );
  }

  // ── 2. What that drift actually cost, on orders that shipped ────────────
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
      shippingCountry: { not: null },
    },
    select: {
      shippingCountry: true,
      shippingCents: true,
      currency: true,
      items: { select: { quantity: true } },
    },
  });

  console.log(`\nORDERS IN THE LAST ${WINDOW_DAYS} DAYS: ${orders.length}`);
  if (orders.length === 0) {
    console.log("  Nothing shipped yet, so the drift has cost nothing.");
    console.log(
      `\n${worst >= DRIFT_ALERT_PERCENT ? "Worth re-freezing before the first orders land." : "Frozen rate still fine."}`,
    );
    return;
  }

  type Row = { charged: number; costNow: number; count: number };
  const single = new Map<string, Row>();
  let absorbedNow = 0;
  let absorbedCount = 0;

  for (const order of orders) {
    const country = order.shippingCountry!.toUpperCase();
    // A country we no longer quote, or never did. Skipped rather than guessed.
    if (SUPPLIER_SHIPPING_USD[country] === undefined) continue;
    const rateNow = spot[order.currency.toUpperCase()];
    if (rateNow === undefined) continue;

    const pairs = order.items.reduce((n, i) => n + i.quantity, 0);
    // The tier for this parcel's size, at TODAY's rate.
    const costNow = Math.round(supplierCostUsdCents(country, pairs) * rateNow);

    if (pairs >= FREE_SHIPPING_FROM_PAIRS) {
      // Free to the customer by design, so the whole cost is absorbed.
      absorbedNow += costNow;
      absorbedCount++;
      continue;
    }
    const row = single.get(country) ?? { charged: 0, costNow: 0, count: 0 };
    row.charged += order.shippingCents;
    row.costNow += costNow;
    row.count++;
    single.set(country, row);
  }

  const currency = orders[0].currency.toUpperCase();
  console.log("\nSINGLE-PAIR ORDERS — charged vs what it costs today");
  let gapTotal = 0;
  for (const [country, row] of [...single].sort(
    (a, b) => a[1].charged - a[1].costNow - (b[1].charged - b[1].costNow),
  )) {
    const gap = row.charged - row.costNow;
    gapTotal += gap;
    console.log(
      `  ${country}  ${String(row.count).padStart(4)} orders  ` +
        `charged ${money(row.charged, currency).padStart(12)}  ` +
        `costs ${money(row.costNow, currency).padStart(12)}  ` +
        `${gap >= 0 ? "+" : ""}${money(gap, currency)}`,
    );
  }

  console.log(
    `\n  Net: ${gapTotal >= 0 ? "+" : ""}${money(gapTotal, currency)} across ${single.size} ${single.size === 1 ? "country" : "countries"}`,
  );
  console.log(
    `  Absorbed on ${absorbedCount} free-shipping orders: ${money(absorbedNow, currency)}`,
  );

  console.log(
    gapTotal < 0 || worst >= DRIFT_ALERT_PERCENT
      ? `\n→ Worth re-freezing FX in src/lib/shipping.ts (move the date with it).`
      : `\n→ Frozen rate still fine.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
