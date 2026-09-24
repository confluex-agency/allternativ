// The case colours, and the cart line key.
//
// Until 2026-09-24 the shopper chose the case (sections 07, 10 and 13 of the
// brief). Daniel's inventory then showed each colourway packed in one case with
// no spares, so the case is now `ProductVariant.caseColor` and nobody picks it.
// Kept in its own module with no server imports, so client components can use
// it without pulling in the database layer.

export const CASE_COLORS = ["BLACK", "WHITE"] as const;

export type CaseColor = (typeof CASE_COLORS)[number];

/** Swatch shown in the selector. */
export const CASE_SWATCH: Record<CaseColor, string> = {
  BLACK: "#1c1c1e",
  WHITE: "#f4f2ee",
};

export function caseLabel(color: CaseColor): string {
  return color === "BLACK" ? "Black" : "White";
}

export function isCaseColor(value: unknown): value is CaseColor {
  return (
    typeof value === "string" && (CASE_COLORS as readonly string[]).includes(value)
  );
}

/**
 * A cart line is a variant plus its case colour. Since the case follows the
 * colourway this is one line per colourway; the format is kept so baskets saved
 * before 2026-09-24, which may hold both cases, still load.
 */
export function cartLineId(variantId: string, caseColor: CaseColor): string {
  return `${variantId}:${caseColor}`;
}
