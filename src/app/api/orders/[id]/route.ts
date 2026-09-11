import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, COMMERCIAL_ROLES } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import {
  MANUAL_STATUSES,
  setManualStatus,
  dispatchByHand,
} from "@/lib/orders-admin";

// The first thing in the admin that CHANGES an order, which is why it is also
// the first thing that writes to `audit_logs`.
//
// ⚠️ The schema here is the security control, not a formality. `status` is an
// enum of exactly the two values a person may set — it cannot express SHIPPED,
// DELIVERED or REFUNDED at all, so no amount of crafting a request reaches
// them. Dispatching is a separate shape that REQUIRES the tracking number,
// because "shipped" and "here is the number" are the same fact and the
// dispatch email is only sent when both are present. See `orders-admin.ts`.

const BodySchema = z.union([
  z.object({ status: z.enum(MANUAL_STATUSES) }),
  z.object({
    trackingNumber: z.string().trim().min(1, "A tracking number is required").max(120),
    carrier: z.string().trim().max(80).optional(),
  }),
]);

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
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid change" },
      { status: 400 },
    );
  }

  if ("status" in parsed.data) {
    const result = await setManualStatus(id, parsed.data.status);
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.reason === "not-found"
              ? "No such order"
              : "This order has already shipped — its status is the courier's now.",
        },
        { status: result.reason === "not-found" ? 404 : 409 },
      );
    }

    await recordAudit({
      actor: auth.user,
      action: "update",
      entityType: "order",
      entityId: id,
      oldValue: { status: result.from },
      newValue: { status: result.to },
    });

    return NextResponse.json({ success: true, status: result.to });
  }

  const result = await dispatchByHand(id, {
    trackingNumber: parsed.data.trackingNumber,
    carrier: parsed.data.carrier ?? null,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "not-found"
            ? "No such order"
            : "Only a paid order that has not shipped can be dispatched.",
      },
      { status: result.reason === "not-found" ? 404 : 409 },
    );
  }

  await recordAudit({
    actor: auth.user,
    action: "update",
    entityType: "order",
    entityId: id,
    entityLabel: result.orderNumber,
    newValue: {
      status: "SHIPPED",
      trackingNumber: result.trackingNumber,
      carrier: parsed.data.carrier ?? null,
      // Worth recording explicitly: this one did not come from the supplier's
      // system, so nobody later wonders why there is no matching row in
      // `woo_request_logs` or an import for it.
      source: "admin-by-hand",
    },
  });

  return NextResponse.json({ success: true, status: "SHIPPED" });
}
