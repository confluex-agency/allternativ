import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { processStripeEvent } from "@/lib/webhooks/process-stripe-event";
import { reserveStock } from "@/lib/inventory";
import { usdCentsTo, supplierCostUsdCents } from "@/lib/shipping";
import {
  prisma,
  RUN,
  makeProduct,
  setCaseStock,
  caseStockOf,
  completedSession,
  cleanUp,
  must,
} from "./helpers";

// The path the money takes.
//
// Written the day it turned out this path had never been executed once: the
// Stripe keys in the project are literally `sk_test_pla...`, so nobody had ever
// completed a purchase, and there was not a single test in the repository. The
// order is not created by the checkout, it is created by the webhook out of
// what Stripe reports, so the webhook is the seam to drive.
//
// It uses the real database rather than a mocked Prisma, because almost
// everything worth asserting here IS database behaviour: stock comes down, a
// case leaves its own pool, a reservation is consumed, costs are frozen, and
// the same event arriving twice must still produce one order.

describe("a completed checkout becomes an order", () => {
  beforeEach(async () => {
    await cleanUp();
    await setCaseStock("BLACK", 100);
    await setCaseStock("WHITE", 100);
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  it("records the order, empties the reservation and takes the stock down", async () => {
    const { product, variant } = await makeProduct({ stock: 10 });
    const group = randomUUID();
    await reserveStock(
      [{ variantId: variant.id, quantity: 2, caseKey: "BLACK" }],
      group,
    );

    const casesAfterReserving = await caseStockOf("BLACK");
    const sessionId = `cs_${RUN}_1`;

    await processStripeEvent(
      completedSession({
        sessionId,
        email: `buyer+${RUN}@example.com`,
        items: [
          {
            variantId: variant.id,
            quantity: 2,
            caseColor: "BLACK",
            sku: variant.sku,
          },
        ],
        reservationGroup: group,
        amountTotal: 7800,
        currency: "eur",
        country: "DE",
      }),
    );

    const order = must(
      await prisma.order.findUnique({
        where: { stripeSessionId: sessionId },
        include: { items: true },
      }),
      "the order",
    );

    expect(order.totalCents).toBe(7800);
    expect(order.currency).toBe("EUR");
    expect(order.items).toHaveLength(1);

    // The snapshot the supplier packs from. If the catalogue is edited
    // tomorrow, this line still says what was actually bought.
    const line = order.items[0];
    expect(line.sku).toBe(variant.sku);
    expect(line.caseColor).toBe("BLACK");
    expect(line.quantity).toBe(2);
    expect(line.productName).toBe(product.name);

    // Stock, on both pools. The eyewear came down when the checkout opened and
    // stays down; the cases did too, and neither may move a second time here.
    const after = must(
      await prisma.productVariant.findUnique({ where: { id: variant.id } }),
      "the variant",
    );
    expect(after.stockQuantity).toBe(8);
    expect(await caseStockOf("BLACK")).toBe(casesAfterReserving);

    // The reservation was CONSUMED rather than left to expire still holding
    // stock. It is marked, not deleted: the row is the evidence that this
    // group of units was taken by this session and not by the sweep.
    const outstanding = await prisma.stockReservation.count({
      where: { groupId: group, consumed: false, releasedAt: null },
    });
    expect(outstanding).toBe(0);
  });

  it("freezes what the pair cost and what the parcel cost", async () => {
    const { variant } = await makeProduct({
      stock: 5,
      supplierCostUsdCents: 338,
    });
    const group = randomUUID();
    await reserveStock(
      [{ variantId: variant.id, quantity: 1, caseKey: "BLACK" }],
      group,
    );

    const sessionId = `cs_${RUN}_cost`;
    await processStripeEvent(
      completedSession({
        sessionId,
        email: `cost+${RUN}@example.com`,
        items: [
          {
            variantId: variant.id,
            quantity: 1,
            caseColor: "BLACK",
            sku: variant.sku,
          },
        ],
        reservationGroup: group,
        amountTotal: 4844,
        currency: "eur",
        country: "DE",
        shippingCents: 944,
      }),
    );

    const order = must(
      await prisma.order.findUnique({
        where: { stripeSessionId: sessionId },
        include: { items: true },
      }),
      "the order",
    );

    // The pair, converted from the supplier dollars at the frozen rate.
    expect(order.items[0].unitCostCents).toBe(usdCentsTo(338, "eur"));

    // The parcel, at what it costs US and not what was charged for it.
    expect(order.shippingCostCents).toBe(
      usdCentsTo(supplierCostUsdCents("DE", 1), "eur"),
    );
  });

  it("prices the line in the market it was sold to, not in euros", async () => {
    // The regression this file exists for. The order used to be recorded at
    // `product.priceCents`, which is the euro figure, while the customer had
    // been charged their own market rate. A British order went into the books
    // at 39 when 34 had been taken, and nothing failed, because the order TOTAL
    // comes from Stripe and was right. Only the line and the subtotal lied,
    // which is exactly the pair of numbers margin reporting reads.
    const { variant } = await makeProduct({
      stock: 5,
      priceCents: 3900,
      marketPrices: [
        { market: "EU", currency: "eur", priceCents: 3900 },
        { market: "GB", currency: "gbp", priceCents: 3400 },
      ],
    });
    const group = randomUUID();
    await reserveStock(
      [{ variantId: variant.id, quantity: 1, caseKey: "BLACK" }],
      group,
    );

    const sessionId = `cs_${RUN}_gb`;
    await processStripeEvent(
      completedSession({
        sessionId,
        email: `gb+${RUN}@example.com`,
        items: [
          {
            variantId: variant.id,
            quantity: 1,
            caseColor: "BLACK",
            sku: variant.sku,
          },
        ],
        reservationGroup: group,
        amountTotal: 3851,
        currency: "gbp",
        country: "GB",
      }),
    );

    const order = must(
      await prisma.order.findUnique({
        where: { stripeSessionId: sessionId },
        include: { items: true },
      }),
      "the order",
    );
    expect(order.items[0].unitPriceCents).toBe(3400);
    expect(order.subtotalCents).toBe(3400);
  });

  it("makes one order when Stripe sends the same event twice", async () => {
    const { variant } = await makeProduct({ stock: 5 });
    const group = randomUUID();
    await reserveStock(
      [{ variantId: variant.id, quantity: 1, caseKey: "BLACK" }],
      group,
    );

    const sessionId = `cs_${RUN}_dup`;
    const event = completedSession({
      sessionId,
      email: `dup+${RUN}@example.com`,
      items: [
        {
          variantId: variant.id,
          quantity: 1,
          caseColor: "BLACK",
          sku: variant.sku,
        },
      ],
      reservationGroup: group,
      amountTotal: 3900,
      currency: "eur",
      country: "DE",
    });

    await processStripeEvent(event);
    await processStripeEvent(event);

    const orders = await prisma.order.count({
      where: { stripeSessionId: sessionId },
    });
    expect(orders).toBe(1);

    // And the stock only moved once. A second decrement here would be a unit
    // sold to nobody, which is the failure that only shows up on the day the
    // shelf is empty and an order cannot be packed.
    const after = must(
      await prisma.productVariant.findUnique({ where: { id: variant.id } }),
      "the variant",
    );
    expect(after.stockQuantity).toBe(4);
  });

  it("puts the stock back when a checkout is abandoned", async () => {
    const { variant } = await makeProduct({ stock: 3 });
    const group = randomUUID();
    await reserveStock(
      [{ variantId: variant.id, quantity: 2, caseKey: "WHITE" }],
      group,
    );

    const whileReserved = must(
      await prisma.productVariant.findUnique({ where: { id: variant.id } }),
      "the variant",
    );
    expect(whileReserved.stockQuantity).toBe(1);

    await processStripeEvent({
      id: `evt_${RUN}_exp`,
      type: "checkout.session.expired",
      data: {
        object: { id: `cs_${RUN}_exp`, metadata: { reservationGroup: group } },
      },
    } as never);

    const after = must(
      await prisma.productVariant.findUnique({ where: { id: variant.id } }),
      "the variant",
    );
    expect(after.stockQuantity).toBe(3);
  });
});
