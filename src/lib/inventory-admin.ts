// Changing stock by hand, without fighting the thing that stops overselling.
//
// ── Why this is not a "set stock to N" form ─────────────────────────────────
//
// ⚠️ Stock is taken by a CONDITIONAL UPDATE when a checkout opens, not when
// payment lands (`reserveStock` in `inventory.ts`). That single statement is
// the entire guarantee that the shop cannot sell the same pair twice, and it
// works because the condition and the write are one operation.
//
// A naive admin form breaks it in a way nothing would report. The person opens
// the page and sees 12. While they are typing, somebody buys two and the row
// becomes 10. They submit "12" — meaning "leave it as it was" — and the write
// puts 12 back, silently un-selling a pair the shop has already taken money
// for. No error, no failed row, and the discrepancy only surfaces when a parcel
// cannot be packed.
//
// So neither operation below writes a number it did not check:
//
//   * `adjustVariantStock` moves stock by a DELTA. "Twenty more arrived" is a
//     delta, and a delta composes with whatever else happened meanwhile.
//   * `setVariantStock` takes the number the person counted AND the number they
//     were looking at when they counted it. If the row moved in between, it
//     refuses and hands back reality rather than overwriting it.

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import type { JWTPayload } from "@/lib/auth";

export type StockChangeResult =
  | { ok: true; quantity: number }
  | { ok: false; reason: "not-found" | "stale"; quantity?: number }
  | { ok: false; reason: "would-oversell"; quantity: number };

interface Actor {
  actor: JWTPayload;
  /** Why, in the person's own words. Required — see the note in `write`. */
  reason: string;
}

/**
 * ⚠️ A reason is mandatory on every change, and it is not bureaucracy.
 *
 * Stock that does not match the shelf is the single most expensive thing to
 * debug in this system, because the number is correct-looking either way. The
 * question asked three weeks later is never "what is the stock" — it is "why is
 * this eleven when the invoice says twelve", and an audit row that says
 * `11 → 12` without a sentence answers nothing at all.
 */
async function writeAudit(
  variant: { id: string; sku: string },
  from: number,
  to: number,
  { actor, reason }: Actor,
) {
  await recordAudit({
    actor,
    action: "update",
    entityType: "product_variant",
    entityId: variant.id,
    entityLabel: variant.sku,
    oldValue: { stockQuantity: from },
    newValue: { stockQuantity: to, reason },
  });
}

/**
 * Move stock by a delta. "Twenty more arrived", "two were damaged".
 *
 * ⚠️ A negative delta cannot push stock below zero, and that is a rule rather
 * than a convenience. Negative stock has one meaning in this system — the shop
 * has taken money for pairs it does not hold — and `reserveStock` refuses every
 * further sale of that colourway on the strength of it. A typo in this form
 * must not be able to manufacture that state: only a real sale may. Somebody
 * correcting a genuine oversold does it by ADDING what arrived.
 */
export async function adjustVariantStock(
  input: { variantId: string; delta: number } & Actor,
): Promise<StockChangeResult> {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    return { ok: false, reason: "not-found" };
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    select: { id: true, sku: true, stockQuantity: true },
  });
  if (!variant) return { ok: false, reason: "not-found" };

  // The condition and the write are one statement, exactly as `reserveStock`
  // does it. `updateMany` is what allows a `where` beyond the primary key.
  const { count } = await prisma.productVariant.updateMany({
    where:
      input.delta < 0
        ? { id: variant.id, stockQuantity: { gte: -input.delta } }
        : { id: variant.id },
    data: { stockQuantity: { increment: input.delta } },
  });

  if (count === 0) {
    const current = await prisma.productVariant.findUnique({
      where: { id: variant.id },
      select: { stockQuantity: true },
    });
    return {
      ok: false,
      reason: "would-oversell",
      quantity: current?.stockQuantity ?? variant.stockQuantity,
    };
  }

  const after = await prisma.productVariant.findUnique({
    where: { id: variant.id },
    select: { stockQuantity: true },
  });
  const quantity = after?.stockQuantity ?? variant.stockQuantity + input.delta;

  await writeAudit(variant, quantity - input.delta, quantity, input);
  return { ok: true, quantity };
}

/**
 * Write the number somebody counted on the shelf.
 *
 * ⚠️ `expected` is required and it is the whole safety of this operation: it is
 * the number the person was looking at when they counted. The write only
 * happens if the row still holds it, so a sale that landed while they were
 * typing refuses the write instead of being erased by it.
 *
 * The screen then shows them what it actually is and they count again — which
 * is annoying exactly once, and is the alternative to a pair that was paid for
 * quietly reappearing on the shelf.
 */
export async function setVariantStock(
  input: { variantId: string; quantity: number; expected: number } & Actor,
): Promise<StockChangeResult> {
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    return { ok: false, reason: "not-found" };
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    select: { id: true, sku: true, stockQuantity: true },
  });
  if (!variant) return { ok: false, reason: "not-found" };

  const { count } = await prisma.productVariant.updateMany({
    where: { id: variant.id, stockQuantity: input.expected },
    data: { stockQuantity: input.quantity },
  });

  if (count === 0) {
    return {
      ok: false,
      reason: "stale",
      quantity: variant.stockQuantity,
    };
  }

  await writeAudit(variant, input.expected, input.quantity, input);
  return { ok: true, quantity: input.quantity };
}
