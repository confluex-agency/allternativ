import { describe, it, expect } from "vitest";
import {
  encodeItemsMetadata,
  decodeItemsMetadata,
  ItemsTooLargeError,
  ITEMS_KEY_PREFIX,
  LEGACY_ITEMS_KEY,
  type CheckoutItem,
} from "@/lib/checkout-metadata";

// The cart crosses from the checkout to the webhook as Stripe metadata, and
// that crossing broke twice in ways nothing caught:
//
//   * A session with no items parsed as an empty array and produced a PAID
//     ORDER WITH NO LINES. Reproduced by `stripe trigger`, whose synthetic
//     session carries no metadata at all.
//   * A cart of five lines exceeded Stripe's 500-character limit on a single
//     metadata value, so Stripe refused the session and the shopper could not
//     pay. Four lines measured 448 characters against the real SKUs; five, 557.
//
// Both were invisible from the database: the first wrote a row that looked
// legitimate, the second never got as far as writing anything.

/** Ids the length Prisma's cuid() actually produces, so sizes are honest. */
const id = (n: number) => `cmt1up00j000f7sk7d7n27${String(n).padStart(3, "0")}`;

const cart = (lines: number): CheckoutItem[] =>
  Array.from({ length: lines }, (_, n) => ({
    variantId: id(n),
    quantity: 1,
    caseColor: n % 2 === 0 ? ("WHITE" as const) : ("BLACK" as const),
  }));

describe("what Stripe will accept", () => {
  it("keeps every value inside the 500-character limit", () => {
    // The limit is Stripe's, not ours, and exceeding it does not degrade
    // anything: it refuses the session outright.
    for (const lines of [1, 4, 5, 12, 32]) {
      for (const [key, value] of Object.entries(encodeItemsMetadata(cart(lines)))) {
        expect(value.length, `${lines} lineas, ${key}`).toBeLessThanOrEqual(500);
      }
    }
  });

  it("carries a five-line cart, which is what used to fail", () => {
    const items = cart(5);
    expect(decodeItemsMetadata(encodeItemsMetadata(items))).toEqual(items);
  });

  it("carries more lines than the catalogue can produce", () => {
    // Sixteen colourways in two case colours is 32 distinct lines, the most a
    // cart can hold. If the ceiling is above that, it is not reachable.
    const items = cart(32);
    expect(decodeItemsMetadata(encodeItemsMetadata(items))).toEqual(items);
  });

  it("splits into numbered keys, starting at zero", () => {
    const meta = encodeItemsMetadata(cart(12));
    expect(Object.keys(meta).length).toBeGreaterThan(1);
    expect(meta[`${ITEMS_KEY_PREFIX}0`]).toBeDefined();
    // Numbered contiguously: a gap would silently truncate the cart.
    for (let n = 0; n < Object.keys(meta).length; n++) {
      expect(meta[`${ITEMS_KEY_PREFIX}${n}`], `chunk ${n}`).toBeDefined();
    }
  });

  it("refuses rather than truncating a cart it cannot encode", () => {
    // Truncating would charge for the whole cart and ship part of it.
    expect(() => encodeItemsMetadata(cart(400))).toThrow(ItemsTooLargeError);
  });
});

describe("what the webhook will accept back", () => {
  it("round-trips a single line unchanged", () => {
    const items = cart(1);
    expect(decodeItemsMetadata(encodeItemsMetadata(items))).toEqual(items);
  });

  it("keeps the case colour, which nothing else records", () => {
    // The case is an option of the purchase, not a variant, so if it is lost
    // here it is lost entirely and the supplier ships the wrong box.
    const items: CheckoutItem[] = [
      { variantId: id(1), quantity: 2, caseColor: "BLACK" },
      { variantId: id(2), quantity: 1, caseColor: "WHITE" },
    ];
    const back = decodeItemsMetadata(encodeItemsMetadata(items));
    expect(back?.map((i) => i.caseColor)).toEqual(["BLACK", "WHITE"]);
  });

  it("returns null for a session with no metadata at all", () => {
    // This is the exact shape of `stripe trigger`, and the shape that used to
    // become an order with nothing in it.
    expect(decodeItemsMetadata(null)).toBeNull();
    expect(decodeItemsMetadata(undefined)).toBeNull();
    expect(decodeItemsMetadata({})).toBeNull();
  });

  it("returns null for an empty cart rather than accepting it", () => {
    expect(decodeItemsMetadata({ [`${ITEMS_KEY_PREFIX}0`]: "[]" })).toBeNull();
    expect(decodeItemsMetadata({ [LEGACY_ITEMS_KEY]: "[]" })).toBeNull();
  });

  it("returns null for a cart it cannot parse", () => {
    expect(decodeItemsMetadata({ [`${ITEMS_KEY_PREFIX}0`]: "{not json" })).toBeNull();
    expect(
      decodeItemsMetadata({ [`${ITEMS_KEY_PREFIX}0`]: '[{"variantId":""}]' }),
    ).toBeNull();
    // A case colour that is not one of ours: the supplier has two boxes.
    expect(
      decodeItemsMetadata({
        [`${ITEMS_KEY_PREFIX}0`]: JSON.stringify([
          { variantId: id(1), quantity: 1, caseColor: "RED" },
        ]),
      }),
    ).toBeNull();
  });

  it("still reads a session written before the split", () => {
    // A session created minutes before a deploy is paid minutes after it. The
    // old format carried a `sku` on every line, which is now ignored.
    const legacy = JSON.stringify([
      {
        variantId: id(1),
        quantity: 1,
        caseColor: "WHITE",
        sku: "THE-CORINTHIAN_BLACK-DOUBLE-GREY",
      },
    ]);
    expect(decodeItemsMetadata({ [LEGACY_ITEMS_KEY]: legacy })).toEqual([
      { variantId: id(1), quantity: 1, caseColor: "WHITE" },
    ]);
  });

  it("prefers the numbered keys when both are present", () => {
    const items = cart(2);
    const meta = {
      ...encodeItemsMetadata(items),
      [LEGACY_ITEMS_KEY]: JSON.stringify([
        { variantId: id(9), quantity: 99, caseColor: "BLACK" },
      ]),
    };
    expect(decodeItemsMetadata(meta)).toEqual(items);
  });

  it("stops at a gap instead of stitching across it", () => {
    // A missing middle chunk means the JSON is incomplete. Closing the gap
    // would produce a shorter cart that still parses, which is the dangerous
    // outcome: a paid order missing lines nobody can see are missing.
    // Twenty lines is three chunks, so deleting the middle one leaves a real
    // hole with content on both sides of it.
    const full = encodeItemsMetadata(cart(20));
    expect(Object.keys(full).length).toBeGreaterThan(2);
    const holed = { ...full };
    delete holed[`${ITEMS_KEY_PREFIX}1`];
    expect(decodeItemsMetadata(holed)).toBeNull();
  });
});
