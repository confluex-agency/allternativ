import { describe, it, expect } from "vitest";
import {
  SUPPLIER_SHIPPING_USD,
  supplierCostUsdCents,
  quoteShipping,
  FX,
  FREE_SHIPPING_FROM_PAIRS,
  FREE_SHIPPING_MAX_PAIRS,
} from "@/lib/shipping";

// The tariff table is the one place in this codebase where a typing slip costs
// money on every order and nothing fails. It is transcribed from a spreadsheet
// the supplier emails, and the spreadsheet is not in the repository - binaries
// live in the vault - so these tests guard the two things that can be checked
// without it: the shape of the table, and the arithmetic built on top of it.
//
// The July quotation is the reason this file exists. It gave Australia the same
// figure for two and three pairs, which made the marginal step zero and would
// have priced a ten-pair parcel like a three-pair one. It was caught by reading
// the numbers, not by a test. Now the shape is asserted.

describe("the tariff table", () => {
  it("quotes five tiers for every country the shop delivers to", () => {
    for (const [country, tiers] of Object.entries(SUPPLIER_SHIPPING_USD)) {
      expect(tiers, country).toHaveLength(5);
    }
  });

  it("steps upward in every row", () => {
    // A flat or falling step is what the July slip looked like, and it is the
    // one shape the extrapolation below cannot survive.
    for (const [country, tiers] of Object.entries(SUPPLIER_SHIPPING_USD)) {
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i], `${country} tier ${i + 1}`).toBeGreaterThan(
          tiers[i - 1],
        );
      }
    }
  });

  it("carries Australia's corrected two-pair rate", () => {
    // Quot-260717 said 11.43, the same as three pairs. Quot-260825 says 10.42.
    expect(SUPPLIER_SHIPPING_USD.AU).toEqual([9.41, 10.42, 11.43, 12.76, 13.93]);
  });

  it("carries the cheapest and dearest rows as quoted", () => {
    // Two spot checks against Quot-260825, one at each end of the table.
    expect(SUPPLIER_SHIPPING_USD.GB).toEqual([6.15, 7.76, 9.37, 11.31, 13.08]);
    expect(SUPPLIER_SHIPPING_USD.MT).toEqual([
      14.64, 18.63, 22.61, 26.92, 31.06,
    ]);
  });

  it("has a frozen exchange rate for every currency the shop sells in", () => {
    for (const currency of ["EUR", "GBP", "USD", "CAD", "AUD", "NZD"]) {
      expect(FX.perUsd[currency], currency).toBeGreaterThan(0);
    }
  });
});

describe("what a parcel costs Allternativ", () => {
  it("reads a quoted figure for every size up to five", () => {
    for (const [country, tiers] of Object.entries(SUPPLIER_SHIPPING_USD)) {
      for (let pairs = 1; pairs <= tiers.length; pairs++) {
        expect(supplierCostUsdCents(country, pairs), `${country} x${pairs}`).toBe(
          Math.round(tiers[pairs - 1] * 100),
        );
      }
    }
  });

  it("covers the whole free-shipping window with quoted figures", () => {
    // The largest parcel the shop gives away is the number the free-shipping
    // rule has to justify itself against. Under the July quotation it was an
    // extrapolation; the point of the August one is that it no longer is.
    expect(FREE_SHIPPING_MAX_PAIRS).toBeLessThanOrEqual(5);
    expect(supplierCostUsdCents("MT", FREE_SHIPPING_MAX_PAIRS)).toBe(2692);
  });

  it("extends by the last quoted step beyond five pairs", () => {
    // Germany's last two tiers are 16.34 and 18.16, a step of 1.82.
    expect(supplierCostUsdCents("DE", 6)).toBe(Math.round((18.16 + 1.82) * 100));
    expect(supplierCostUsdCents("DE", 7)).toBe(
      Math.round((18.16 + 2 * 1.82) * 100),
    );
  });

  it("never gets cheaper as the parcel grows", () => {
    for (const country of Object.keys(SUPPLIER_SHIPPING_USD)) {
      for (let pairs = 2; pairs <= 12; pairs++) {
        expect(
          supplierCostUsdCents(country, pairs),
          `${country} x${pairs}`,
        ).toBeGreaterThan(supplierCostUsdCents(country, pairs - 1));
      }
    }
  });

  it("returns zero rather than guessing for an unquoted country", () => {
    expect(supplierCostUsdCents("JP", 1)).toBe(0);
    expect(supplierCostUsdCents("DE", 0)).toBe(0);
  });
});

describe("what the customer is charged", () => {
  it("charges the one-pair rate, converted at the frozen rate", () => {
    const quote = quoteShipping("DE", 1, "EUR")!;
    expect(quote.free).toBe(false);
    expect(quote.amountCents).toBe(Math.round(11.03 * 100 * FX.perUsd.EUR));
  });

  it("gives delivery away from two pairs to four", () => {
    for (
      let pairs = FREE_SHIPPING_FROM_PAIRS;
      pairs <= FREE_SHIPPING_MAX_PAIRS;
      pairs++
    ) {
      const quote = quoteShipping("MT", pairs, "EUR")!;
      expect(quote.free, `${pairs} pairs`).toBe(true);
      expect(quote.amountCents).toBe(0);
    }
  });

  it("charges the quoted five-pair rate at the fifth pair", () => {
    // The step the client accepted on 2026-08-21: the fifth pair pays for the
    // whole parcel. It should pay the quoted figure, not an extrapolation.
    const quote = quoteShipping("MT", 5, "EUR")!;
    expect(quote.free).toBe(false);
    expect(quote.amountCents).toBe(Math.round(31.06 * 100 * FX.perUsd.EUR));
  });

  it("refuses a country outside the quotation", () => {
    expect(quoteShipping("JP", 1, "EUR")).toBeNull();
  });
});
