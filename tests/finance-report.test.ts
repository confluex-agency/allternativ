import { describe, expect, it } from "vitest";
import { totalsByCurrency, type OrderMargin } from "@/lib/finance-report";

// The totals are the figures somebody will repeat, so two properties are
// pinned: currencies are never added together, and an order with a cost
// missing is left out of the sums rather than counted as free.

function order(over: Partial<OrderMargin>): OrderMargin {
  return {
    id: "o",
    orderNumber: "ALT-1",
    at: new Date(),
    currency: "eur",
    pairs: 1,
    country: "DE",
    revenueCents: 4800,
    discountCents: 0,
    goodsCents: 480,
    shippingCostCents: 900,
    shippingAbsorbed: false,
    feeCents: 100,
    netCents: 3320,
    ...over,
  };
}

describe("finance totals", () => {
  it("keeps one line per currency", () => {
    const totals = totalsByCurrency([
      order({ id: "a" }),
      order({ id: "b", currency: "gbp", revenueCents: 4000, netCents: 2500 }),
    ]);
    expect(totals.map((t) => t.currency)).toEqual(["eur", "gbp"]);
    expect(totals[0].netCents).toBe(3320);
  });

  it("leaves an order with an unknown cost out of the sums, and says so", () => {
    const [eur] = totalsByCurrency([
      order({ id: "a" }),
      order({ id: "b", goodsCents: null, netCents: null }),
    ]);
    expect(eur.orders).toBe(2);
    expect(eur.incomplete).toBe(1);
    expect(eur.revenueCents).toBe(4800);
  });

  it("counts what the free-delivery rule gave away", () => {
    const [eur] = totalsByCurrency([
      order({ id: "a", pairs: 2, shippingAbsorbed: true, shippingCostCents: 1500 }),
      order({ id: "b" }),
    ]);
    expect(eur.absorbedOrders).toBe(1);
    expect(eur.absorbedShippingCents).toBe(1500);
  });
});
