import { describe, expect, it } from "vitest";
import { isTestOrder, labelIfTest, TEST_ORDER_LABEL } from "@/lib/test-order";
import { toWooOrder, type ExportableOrder } from "@/lib/woo/order-mapper";

// The supplier had to ask whether a complete, correct-looking order was a
// rehearsal. These pin the answer into the two places he can see it.

function order(sessionId: string | null): ExportableOrder {
  return {
    id: "ord_1",
    orderNumber: "ALT-20260910-1253",
    wooId: 1,
    stripeSessionId: sessionId,
    status: "PAID",
    currency: "EUR",
    subtotalCents: 11700,
    shippingCents: 0,
    discountCents: 0,
    totalCents: 11700,
    createdAt: new Date("2026-09-10T21:47:28Z"),
    updatedAt: new Date("2026-09-10T21:47:28Z"),
    shippingName: "Nicolas Boggioni",
    shippingCountry: "IE",
    customer: { email: "buyer@example.com", name: "Nicolas", phone: null },
    items: [
      {
        sku: "NEON-SHIFT_BLACK-BLACK",
        productName: "Neon Shift",
        variantName: "Black / Black",
        caseColor: "BLACK",
        quantity: 1,
        unitPriceCents: 3900,
      },
    ],
    // Everything else the mapper does not read for this assertion.
  } as unknown as ExportableOrder;
}

describe("a rehearsal says it is one", () => {
  it("reads Stripe's own prefix rather than a column of our own", () => {
    // `cs_test_` / `cs_live_` is written by Stripe and is the same fact as
    // `livemode` on the session, without a round trip to ask.
    expect(isTestOrder({ stripeSessionId: "cs_test_b14pIrU1GEL" })).toBe(true);
    expect(isTestOrder({ stripeSessionId: "cs_live_b14pIrU1GEL" })).toBe(false);
    // An order with no session at all is not a test — it is something else,
    // and claiming otherwise would be the mistake in the other direction.
    expect(isTestOrder({ stripeSessionId: null })).toBe(false);
  });

  it("labels the note the supplier actually reads, and keeps the packing note", () => {
    const live = toWooOrder(order("cs_live_realmoney"));
    const test = toWooOrder(order("cs_test_rehearsal"));

    // The case colours are the one instruction the warehouse cannot get wrong,
    // so the label goes IN FRONT of them, never instead of them.
    expect(live.customer_note).toContain("BLACK case x1");
    expect(live.customer_note).not.toContain("TEST ORDER");

    expect(test.customer_note.startsWith(TEST_ORDER_LABEL)).toBe(true);
    expect(test.customer_note).toContain("BLACK case x1");
  });

  it("still labels an order that has no packing note of its own", () => {
    // No case colour means `packingNote` returns "". The label must not come
    // out as a stray separator or an empty string.
    const bare = labelIfTest({ stripeSessionId: "cs_test_x" }, "");
    expect(bare).toBe(TEST_ORDER_LABEL);
    expect(bare).not.toContain("|");
  });

  it("leaves a real order completely untouched", () => {
    expect(labelIfTest({ stripeSessionId: "cs_live_x" }, "CASE COLOURS - x")).toBe(
      "CASE COLOURS - x",
    );
  });
});
