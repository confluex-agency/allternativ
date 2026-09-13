import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { prisma, RUN, cleanUp, must, makeProduct } from "./helpers";
import { adjustVariantStock, setVariantStock } from "@/lib/inventory-admin";
import type { JWTPayload } from "@/lib/auth";

let actor: JWTPayload;
let variantId: string;

beforeAll(async () => {
  const admin = await prisma.adminUser.create({
    data: {
      email: `stock-actor.${RUN}@example.com`,
      name: "Stock Actor",
      role: "ECOMMERCE_ADMIN",
      passwordHash: "not-a-real-hash",
    },
  });
  actor = {
    sub: admin.id,
    email: admin.email,
    role: "ECOMMERCE_ADMIN",
    name: admin.name,
  } as JWTPayload;

  // The shared helper, deliberately: it already knows the required columns
  // (`type`, the LIVE status) and its rows carry RUN so `cleanUp` finds them.
  const { variant } = await makeProduct({ stock: 10 });
  variantId = variant.id;
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

async function currentStock() {
  const row = must(
    await prisma.productVariant.findUnique({ where: { id: variantId } }),
    "the variant",
  );
  return row.stockQuantity;
}

describe("moving stock by a delta", () => {
  it("adds what arrived and records why", async () => {
    const before = await currentStock();
    const result = await adjustVariantStock({
      variantId,
      delta: 5,
      reason: "supplier delivery",
      actor,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.quantity).toBe(before + 5);
    expect(await currentStock()).toBe(before + 5);

    // ⚠️ The reason is the point of the audit row. `10 → 15` with no sentence
    // answers nothing three weeks later.
    const entry = must(
      await prisma.auditLog.findFirst({
        where: { entityType: "product_variant", entityId: variantId },
        orderBy: { createdAt: "desc" },
      }),
      "the audit entry",
    );
    expect((entry.newValue as { reason?: string })?.reason).toBe(
      "supplier delivery",
    );
    expect((entry.oldValue as { stockQuantity?: number })?.stockQuantity).toBe(
      before,
    );
  });

  it("removes what was damaged", async () => {
    const before = await currentStock();
    const result = await adjustVariantStock({
      variantId,
      delta: -2,
      reason: "two damaged in transit",
      actor,
    });
    expect(result.ok).toBe(true);
    expect(await currentStock()).toBe(before - 2);
  });

  it("refuses a removal that would take stock below zero", async () => {
    // ⚠️ The rule this file exists for. Negative stock has ONE meaning here —
    // the shop has taken money for pairs it does not hold — and `reserveStock`
    // refuses every further sale of that colourway on the strength of it. A
    // typo in an admin form must not be able to manufacture that state; only a
    // real sale may.
    const before = await currentStock();
    const result = await adjustVariantStock({
      variantId,
      delta: -(before + 1),
      reason: "a fat-fingered number",
      actor,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("would-oversell");
    expect(await currentStock()).toBe(before);
  });
});

describe("writing down what somebody counted", () => {
  it("writes the count when the row still holds what they were shown", async () => {
    const before = await currentStock();
    const result = await setVariantStock({
      variantId,
      quantity: before + 3,
      expected: before,
      reason: "stocktake",
      actor,
    });
    expect(result.ok).toBe(true);
    expect(await currentStock()).toBe(before + 3);
  });

  it("refuses when a sale landed while they were counting", async () => {
    // ⚠️ The failure this whole module is shaped around. The person opened the
    // page at 12, somebody bought two, and they submit "12" meaning "leave it".
    // A plain write would put 12 back and silently un-sell a pair the shop has
    // already been paid for — no error, no failed row, and it only surfaces
    // when a parcel cannot be packed.
    const shownOnScreen = await currentStock();

    // Somebody buys while the form is open.
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { stockQuantity: { decrement: 2 } },
    });
    const reality = await currentStock();

    const result = await setVariantStock({
      variantId,
      quantity: shownOnScreen,
      expected: shownOnScreen,
      reason: "stocktake against a stale screen",
      actor,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("stale");
      // Reality comes back, so the screen can show it rather than just refuse.
      expect(result.quantity).toBe(reality);
    }
    // And nothing was written: the sold pair stays sold.
    expect(await currentStock()).toBe(reality);
  });

  it("refuses a negative count outright", async () => {
    const before = await currentStock();
    const result = await setVariantStock({
      variantId,
      quantity: -1,
      expected: before,
      reason: "nonsense",
      actor,
    });
    expect(result.ok).toBe(false);
    expect(await currentStock()).toBe(before);
  });
});
