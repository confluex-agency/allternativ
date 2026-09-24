import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, COMMERCIAL_ROLES } from "@/lib/auth";
import { createPromotion } from "@/lib/promotions-admin";

// Create a discount code in Stripe from the admin. The rules are in
// `promotions-admin.ts`. COMMERCIAL_ROLES: a code is a price cut.

const BodySchema = z.object({
  code: z.string().trim().min(1).max(64),
  // 90 is a typo guard. The checkout refuses anything below cost regardless;
  // this only stops "100" being typed for "10".
  percentOff: z.number().int().min(1).max(90),
  maxRedemptions: z.number().int().min(1).max(100_000).nullable().default(null),
  expiresAt: z.coerce.date().nullable().default(null),
  firstOrderOnly: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const auth = await requireRole(...COMMERCIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error?.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  if (parsed.data.expiresAt && parsed.data.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "The end date is in the past." }, { status: 400 });
  }

  const result = await createPromotion({ ...parsed.data, actor: auth.user });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ id: result.id, code: result.code });
}
