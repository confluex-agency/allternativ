// Purchase options that are NOT product variants.
//
// The case colour is chosen at checkout and travels with the order, but it does
// not create a separate SKU: Orbital Black is one product whichever case you
// pick (sections 07, 10 and 13 of the client brief). Kept in its own module with
// no server imports, so client components can use it without pulling in the
// database layer.

export const CASE_COLORS = ["BLACK", "WHITE"] as const;

export type CaseColor = (typeof CASE_COLORS)[number];

export const DEFAULT_CASE_COLOR: CaseColor = "BLACK";

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
 * A cart line is a variant plus a case colour: the same sunglasses with a black
 * case and with a white case are two lines, not one with quantity two.
 */
export function cartLineId(variantId: string, caseColor: CaseColor): string {
  return `${variantId}:${caseColor}`;
}
