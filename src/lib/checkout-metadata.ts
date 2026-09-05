// What the cart has to survive on between the checkout and the webhook.
//
// The shopper leaves for Stripe's hosted page and comes back as an event. The
// order lines are rebuilt from that event, so whatever the webhook needs has to
// travel on the session. Stripe metadata is where it travels, and Stripe
// metadata has hard limits: **500 characters per value**, 50 keys.
//
// ── Why this is a module and not two inline JSON.stringify calls ────────────
// It was two, and they drifted into a bug that only a large cart could reach.
// The checkout wrote one string, the webhook parsed it, and nobody owned the
// format, so nobody noticed it had a ceiling. Encoding and decoding now sit
// next to each other and are tested together.
//
// Two things are fixed here:
//
//  1. **The cart no longer fits in one value past four lines.** Measured
//     against the real SKUs, four lines came to 448 characters and five to 557,
//     so a five-line cart made Stripe refuse the session and the shopper could
//     not pay at all. Free delivery runs from two to four pairs, so the large
//     cart is the one the shop is actively pushing people towards. The payload
//     is now split across numbered keys, which lifts the ceiling from ~4 lines
//     to far past the 32 the catalogue can even produce.
//  2. **`sku` was dead weight.** It was written on every line and read nowhere:
//     the webhook snapshots `variant.sku` from the database, not this copy. It
//     was a third of the payload. Dropping it is what makes each line small.
//
// The line is therefore the smallest thing that cannot be recovered from the
// database: which variant, how many, and which case colour — the case being an
// option of the purchase rather than a variant, so nothing else records it.

import { z } from "zod";
import { CASE_COLORS } from "@/lib/product-options";

/** Stripe's documented limit for a single metadata value. */
const MAX_VALUE_CHARS = 500;

/**
 * How many numbered keys the cart may use. Stripe allows 50 keys in total and
 * the session needs a few for its own purposes; 20 is far more than the
 * catalogue can fill and still leaves room. Past it we refuse rather than
 * silently drop lines, because a truncated cart charges for what it kept.
 */
const MAX_CHUNKS = 20;

export const ITEMS_KEY_PREFIX = "items_";

/** The legacy single-value key, still read so sessions in flight during a
 * deploy are not orphaned. Written by the code this replaced. */
export const LEGACY_ITEMS_KEY = "items";

export const CheckoutItemSchema = z.object({
  variantId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(100),
  caseColor: z.enum(CASE_COLORS),
});

/**
 * ⚠️ `.min(1)` is not decoration. Without it an empty array parsed happily, and
 * a session whose items were missing produced an ORDER WITH NO LINES: a paid
 * row, a customer, a total, and nothing to ship. It was caught by a synthetic
 * `stripe trigger`, whose session carries no metadata at all — which is exactly
 * the shape of the accident. An order that does not know what it was for is the
 * one thing this codebase says an order may never be.
 */
export const ItemsMetadataSchema = z.array(CheckoutItemSchema).min(1);

export type CheckoutItem = z.infer<typeof CheckoutItemSchema>;

/** Raised when the cart cannot be encoded. Refusing beats truncating. */
export class ItemsTooLargeError extends Error {
  constructor(chunks: number) {
    super(
      `Cart needs ${chunks} metadata keys, over the ${MAX_CHUNKS} allowed. ` +
        `Refusing rather than dropping lines from a paid order.`,
    );
    this.name = "ItemsTooLargeError";
  }
}

/**
 * Encode the cart for `metadata`, split across `items_0`, `items_1`, ... .
 *
 * The split is on the raw string, not on line boundaries: a line may straddle
 * two keys. That is deliberate — it makes the ceiling depend on total size
 * rather than on the longest line, and the decoder joins before parsing, so the
 * seam never has to be understood by anything but these two functions.
 */
export function encodeItemsMetadata(
  items: readonly CheckoutItem[],
): Record<string, string> {
  const json = JSON.stringify(
    items.map((i) => ({
      variantId: i.variantId,
      quantity: i.quantity,
      caseColor: i.caseColor,
    })),
  );

  const chunks: string[] = [];
  for (let at = 0; at < json.length; at += MAX_VALUE_CHARS) {
    chunks.push(json.slice(at, at + MAX_VALUE_CHARS));
  }
  if (chunks.length > MAX_CHUNKS) throw new ItemsTooLargeError(chunks.length);

  return Object.fromEntries(
    chunks.map((chunk, n) => [`${ITEMS_KEY_PREFIX}${n}`, chunk]),
  );
}

/**
 * Rebuild the cart from a session's metadata, or return null if it cannot be
 * read. Null is the caller's cue to reject the event permanently: a session
 * whose cart is unreadable will still be unreadable tomorrow.
 *
 * Reads the numbered keys in order, and falls back to the legacy single key so
 * a session created just before a deploy still becomes an order.
 */
export function decodeItemsMetadata(
  metadata: Record<string, string> | null | undefined,
): CheckoutItem[] | null {
  if (!metadata) return null;

  let json: string | undefined;

  // Numbered keys are read by index rather than by scanning the object, so a
  // missing middle chunk truncates instead of silently closing the gap.
  if (metadata[`${ITEMS_KEY_PREFIX}0`] !== undefined) {
    const parts: string[] = [];
    for (let n = 0; n < MAX_CHUNKS; n++) {
      const part = metadata[`${ITEMS_KEY_PREFIX}${n}`];
      if (part === undefined) break;
      parts.push(part);
    }
    json = parts.join("");
  } else if (metadata[LEGACY_ITEMS_KEY] !== undefined) {
    json = metadata[LEGACY_ITEMS_KEY];
  }

  if (json === undefined) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }

  // The legacy shape carried a `sku` on every line. Stripping unknown keys
  // rather than rejecting them is what lets an old session still be read.
  const parsed = ItemsMetadataSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
