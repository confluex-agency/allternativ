import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { processStripeEvent } from "@/lib/webhooks/process-stripe-event";
import { reserveStock } from "@/lib/inventory";
import { buildReport } from "@/lib/analytics-report";
import { prisma, RUN, makeProduct, completedSession, cleanUp } from "./helpers";

// Section 29 is open to every admin role, ANALYTICS_VIEWER included, so the
// report is held to a PROPERTY rather than a list of fields: nothing that
// identifies the buyer may appear anywhere in it.

const buyer = `analytics-buyer+${RUN}@example.com`;
let sku: string;

beforeAll(async () => {
  await cleanUp();
  const { variant } = await makeProduct({ stock: 10 });
  sku = variant.sku;
  const group = randomUUID();
  await reserveStock([{ variantId: variant.id, quantity: 2 }], group);
  await processStripeEvent(
    completedSession({
      sessionId: `cs_${RUN}_analytics`,
      email: buyer,
      items: [{ variantId: variant.id, quantity: 2, caseColor: "BLACK" }],
      reservationGroup: group,
      amountTotal: 7800,
      currency: "eur",
      country: "DE",
    }),
  );
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

describe("the analytics report", () => {
  it("counts the pairs that moved against what is left", async () => {
    const report = await buildReport(7);
    const row = report.colourways.find((c) => c.sku === sku);
    expect(row).toMatchObject({ sold: 2, inStock: 8 });
    expect(row?.sellThrough).toBeCloseTo(0.2);
  });

  it("never carries anything that identifies the buyer", async () => {
    const text = JSON.stringify(await buildReport(90));
    expect(text).not.toContain(buyer);
    expect(text).not.toContain("Test Buyer");
    expect(text).not.toContain("+1 555");
  });
});
