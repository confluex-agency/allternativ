import { describe, expect, it } from "vitest";
import { describe as sentence } from "@/lib/audit-view";

// The activity page is read by the founders, so every kind of row has to come
// out as a sentence — and a kind nobody wrote a sentence for must still show.

describe("the activity sentences", () => {
  it("says a stock change as a change of number", () => {
    expect(
      sentence("product_variant", "update", { stockQuantity: 11 }, { stockQuantity: 12, reason: "count" }),
    ).toBe("Stock 11 → 12");
  });

  it("says a price in its own currency", () => {
    expect(
      sentence(
        "market_price",
        "update",
        { market: "GB", currency: "gbp", priceCents: 3400 },
        { market: "GB", currency: "gbp", priceCents: 3500 },
      ),
    ).toBe("GB price £34.00 → £35.00");
  });

  it("tells a status change from a dispatch", () => {
    expect(sentence("order", "update", { status: "PAID" }, { status: "CANCELLED" })).toBe(
      "Status PAID → CANCELLED",
    );
    expect(
      sentence("order", "update", null, {
        status: "SHIPPED",
        trackingNumber: "YT1",
        carrier: "yunexpress",
      }),
    ).toBe("Dispatched by hand, yunexpress YT1");
  });

  it("never hides a kind it does not know", () => {
    expect(sentence("promotion", "create", null, { code: "LAUNCH" })).toContain("LAUNCH");
  });
});
