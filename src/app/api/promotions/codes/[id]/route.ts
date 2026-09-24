import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, COMMERCIAL_ROLES } from "@/lib/auth";
import { setPromotionActive } from "@/lib/promotions-admin";

// Switch a code off, or back on. Stripe keeps the code and its redemptions
// either way, so nothing about past orders changes.

const BodySchema = z.object({ active: z.boolean() });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(...COMMERCIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const { id } = await params;
  if (!/^promo_[A-Za-z0-9]+$/.test(id)) {
    return NextResponse.json({ error: "No such code" }, { status: 404 });
  }
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await setPromotionActive({
    id,
    active: parsed.data.active,
    actor: auth.user,
  });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ active: parsed.data.active });
}
