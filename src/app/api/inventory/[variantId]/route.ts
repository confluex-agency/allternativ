import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, COMMERCIAL_ROLES } from "@/lib/auth";
import { adjustVariantStock, setVariantStock } from "@/lib/inventory-admin";

// Change the stock on one colourway.
//
// ⚠️ COMMERCIAL_ROLES, not "any signed-in admin". Stock is money: a number
// typed here decides what the shop will sell and what it refuses. Section 18
// puts inventory under ECOMMERCE_ADMIN, and CONTENT_ADMIN — who may edit copy
// and images — has no business moving it.
//
// Two shapes, and the difference is not cosmetic; see `inventory-admin.ts`.
//   { delta: 20 }                  twenty more arrived
//   { quantity: 11, expected: 12 } I counted eleven, and I was looking at twelve

const BodySchema = z.union([
  z.object({
    delta: z.number().int().refine((n) => n !== 0, "Nothing to change"),
    reason: z.string().min(1).max(500),
  }),
  z.object({
    quantity: z.number().int().min(0),
    expected: z.number().int(),
    reason: z.string().min(1).max(500),
  }),
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> },
) {
  const auth = await requireRole(...COMMERCIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const { variantId } = await params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      // ⚠️ The reason is required by the schema, so this is where a missing one
      // lands. Said plainly rather than as "invalid request", because it is the
      // field somebody will be surprised to have to fill in.
      { error: parsed.error?.issues[0]?.message ?? "Say what changed and why" },
      { status: 400 },
    );
  }

  const result =
    "delta" in parsed.data
      ? await adjustVariantStock({
          variantId,
          delta: parsed.data.delta,
          reason: parsed.data.reason,
          actor: auth.user,
        })
      : await setVariantStock({
          variantId,
          quantity: parsed.data.quantity,
          expected: parsed.data.expected,
          reason: parsed.data.reason,
          actor: auth.user,
        });

  if (result.ok) return NextResponse.json({ quantity: result.quantity });

  if (result.reason === "not-found") {
    return NextResponse.json({ error: "No such colourway" }, { status: 404 });
  }

  if (result.reason === "would-oversell") {
    return NextResponse.json(
      {
        error:
          `There are only ${result.quantity} left, so this would take stock ` +
          `below zero. Negative stock means the shop has taken money for pairs ` +
          `it does not hold, and only a sale may create that.`,
        quantity: result.quantity,
      },
      { status: 409 },
    );
  }

  // Stale: somebody bought while this person was counting. The number comes
  // back so the screen can show reality rather than just refusing.
  return NextResponse.json(
    {
      error:
        `Stock changed while you were editing — it is ${result.quantity} now, ` +
        `not what this form was showing. Nothing was written. Check the shelf ` +
        `against the new figure.`,
      quantity: result.quantity,
      reason: "stale",
    },
    { status: 409 },
  );
}
