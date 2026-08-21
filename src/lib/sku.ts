// The code the warehouse in Shenzhen reads off the packing slip.
//
// Daniel answered the blocking question on 2026-08-21, and the answer was not
// the one the supplier document expected:
//
//   "SKUs should be created on your side. It's better to created them in a
//    specific and easily identifiable format, for example,
//    'Model Name_Sunglass Colour_Case Colour'."
//
// So there is no supplier variant code to map against. There never was one:
// `ProductVariant.supplierSku` stays null, on purpose, because filling it in
// with something of ours would pretend we had his. WE define the string, and a
// person reads it. Which is why it is words and not numbers - `89310-OLV` is
// only meaningful to somebody holding the invoice, and the packer is not.
//
// ── The case colour is part of the SKU, and it cannot come from the variant ──
// The customer picks black or white at the last step, so two orders for the
// same colourway can need different boxes. The case is an option of the
// purchase, not a colourway of the product, which is why it lives on
// `OrderItem` and why the full code can only be assembled per line item, at the
// moment of sale. `variantSku` is the catalogue half; `fulfilmentSku` is what
// travels.

/** Uppercase, no spaces, no slashes, nothing a CSV or a shell will chew on. */
function segment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * `THE-CORINTHIAN_OLIVE-GREEN`. Daniel's format minus the case, which the
 * catalogue does not know yet.
 *
 * ⚠️ Only for generating a code that does not exist yet. The SKUs already in
 * `catalogue-source.ts` are written out literally and must stay that way: if
 * they were derived from the colour names, the editorial pass the client still
 * owes on names like "Black Black" would silently rewrite codes that Daniel's
 * system had already mapped, and nothing would report it.
 */
export function variantSku(productName: string, colorName: string): string {
  return `${segment(productName)}_${segment(colorName)}`;
}

/**
 * `THE-CORINTHIAN_OLIVE-GREEN_BLACK`. The whole thing, per line item.
 *
 * Falls back to the bare variant SKU when no case colour was recorded, rather
 * than inventing one. A code ending in `_BLACK` when nobody chose black would
 * send the wrong box out with no way to notice.
 */
export function fulfilmentSku(
  variantSkuValue: string,
  caseColor: string | null | undefined,
): string {
  if (!caseColor) return variantSkuValue;
  return `${variantSkuValue}_${segment(caseColor)}`;
}
