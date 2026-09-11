import { describe, expect, it, afterAll } from "vitest";
import { prisma, RUN, cleanUp, must } from "./helpers";
import { setManualStatus, dispatchByHand } from "@/lib/orders-admin";
import { MANUAL_STATUSES } from "@/lib/order-status";
import { EMAIL_MAX_ATTEMPTS } from "@/lib/email";

const EMAIL = `admin-orders.${RUN}@example.com`;

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

async function makeOrder(suffix: string, status: "PAID" | "PROCESSING" | "SHIPPED") {
  const customer = await prisma.customer.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, name: "Test Buyer" },
  });
  return prisma.order.create({
    data: {
      orderNumber: `ORD-${RUN}-${suffix}`,
      customerId: customer.id,
      status,
      subtotalCents: 3900,
      totalCents: 3900,
      currency: "EUR",
      ...(status === "SHIPPED"
        ? { trackingNumber: `TRK-${suffix}`, shippedAt: new Date() }
        : {}),
    },
  });
}

describe("what a person may set by hand", () => {
  it("offers only the statuses nobody downstream depends on", () => {
    // ⚠️ The list IS the control. `MANUAL_STATUSES` is what the route's zod
    // enum is built from, so a value missing here cannot be expressed by any
    // request at all — no amount of crafting the body reaches it.
    expect([...MANUAL_STATUSES]).toEqual(["PROCESSING", "CANCELLED"]);

    // Named individually so that adding one is a decision somebody has to
    // make on purpose, with this test going red to ask them why.
    expect(MANUAL_STATUSES).not.toContain("SHIPPED");
    expect(MANUAL_STATUSES).not.toContain("DELIVERED");
    expect(MANUAL_STATUSES).not.toContain("REFUNDED");
    expect(MANUAL_STATUSES).not.toContain("PAID");
  });

  it("moves a paid order to processing", async () => {
    const order = await makeOrder("PROC", "PAID");
    const result = await setManualStatus(order.id, "PROCESSING");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.from).toBe("PAID");

    const after = must(
      await prisma.order.findUnique({ where: { id: order.id } }),
      "the order",
    );
    expect(after.status).toBe("PROCESSING");
    // Nothing else moved: no tracking invented, nothing marked as gone.
    expect(after.trackingNumber).toBeNull();
    expect(after.shippedAt).toBeNull();
  });

  it("refuses to re-open an order that has already gone", async () => {
    const order = await makeOrder("GONE", "SHIPPED");
    const result = await setManualStatus(order.id, "PROCESSING");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("already-shipped");

    expect(
      (await prisma.order.findUnique({ where: { id: order.id } }))!.status,
    ).toBe("SHIPPED");
  });

  it("does not restore stock or refund when cancelling", async () => {
    // Both are separate acts with their own consequences — the units left when
    // the checkout opened, and the money is in Stripe. This records a decision
    // and nothing more, and the screen says so.
    const order = await makeOrder("CANC", "PAID");
    await setManualStatus(order.id, "CANCELLED");
    const after = must(
      await prisma.order.findUnique({ where: { id: order.id } }),
      "the order",
    );
    expect(after.status).toBe("CANCELLED");
    expect(after.refundedCents).toBe(0);
  });
});

describe("dispatching by hand", () => {
  it("writes the status and the tracking number in the same act", async () => {
    const order = await makeOrder("SHIP", "PAID");
    const result = await dispatchByHand(order.id, {
      trackingNumber: "  LP00123456789CN  ",
      carrier: " Correos ",
    });
    expect(result.ok).toBe(true);

    const after = must(
      await prisma.order.findUnique({ where: { id: order.id } }),
      "the order",
    );
    expect(after.status).toBe("SHIPPED");
    expect(after.trackingNumber).toBe("LP00123456789CN");
    expect(after.carrier).toBe("Correos");
    expect(after.shippedAt).not.toBeNull();
  });

  it("refuses without a tracking number, which is the whole point", async () => {
    // ⚠️ This is the failure the dropdown was redesigned to make impossible.
    // An order marked SHIPPED with nothing to track is skipped by the sweep
    // for ever — `dispatchEmailStatus` stays PENDING, no row fails, nobody
    // looks, and the buyer is never told their parcel is moving.
    const order = await makeOrder("EMPTY", "PAID");
    const result = await dispatchByHand(order.id, {
      trackingNumber: "   ",
      carrier: null,
    });
    expect(result.ok).toBe(false);

    const after = must(
      await prisma.order.findUnique({ where: { id: order.id } }),
      "the order",
    );
    expect(after.status).toBe("PAID");
    expect(after.shippedAt).toBeNull();
  });

  it("refuses an order that has already shipped", async () => {
    const order = await makeOrder("TWICE", "SHIPPED");
    const result = await dispatchByHand(order.id, {
      trackingNumber: "SOMETHING-ELSE",
      carrier: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not-dispatchable");

    expect(
      (await prisma.order.findUnique({ where: { id: order.id } }))!
        .trackingNumber,
    ).toBe("TRK-TWICE");
  });

  it("leaves the order in exactly the shape the sweep is looking for", async () => {
    // The two ends tied together. `drainDispatchEmails` asks for PENDING, a
    // shipped status, a tracking number and attempts under the cap; if a hand
    // dispatch did not satisfy all four, the buyer would never be told — which
    // is the silent failure this whole design exists to avoid.
    const order = await makeOrder("DUE", "PAID");
    await dispatchByHand(order.id, {
      trackingNumber: "LP999",
      carrier: null,
    });

    const due = await prisma.order.findFirst({
      where: {
        id: order.id,
        dispatchEmailStatus: "PENDING",
        status: { in: ["SHIPPED", "DELIVERED"] },
        trackingNumber: { not: null },
        dispatchEmailAttempts: { lt: EMAIL_MAX_ATTEMPTS },
      },
    });
    expect(due).not.toBeNull();
  });
});
