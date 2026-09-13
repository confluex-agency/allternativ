import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { changeAdminRole, setAdminActive } from "@/lib/admin-users";

// Change somebody's role, or take their access away.
//
// ⚠️ OWNER only, for the reason on the collection route: this is the endpoint
// that decides who may use every other endpoint.

const PatchSchema = z.object({
  role: z
    .enum(["OWNER", "ECOMMERCE_ADMIN", "CONTENT_ADMIN", "ANALYTICS_VIEWER"])
    .optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole("OWNER");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const { id } = await params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { role, isActive } = parsed.data;
  if (role === undefined && isActive === undefined) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  // ⚠️ Deactivation is applied BEFORE a role change when both arrive, so a
  // single request cannot be used to step around `wouldStrandTheBuilding` by
  // demoting the last OWNER and switching them off in one go. In practice the
  // screen sends one at a time; this is so the API does not depend on that.
  if (isActive !== undefined) {
    const result = await setAdminActive({
      targetId: id,
      isActive,
      actor: auth.user,
    });
    if (!result.ok) return refusal(result.reason);
  }

  if (role !== undefined) {
    const result = await changeAdminRole({
      targetId: id,
      role,
      actor: auth.user,
    });
    if (!result.ok) return refusal(result.reason);
  }

  return NextResponse.json({ updated: true });
}

function refusal(reason: "not-found" | "last-owner") {
  if (reason === "not-found") {
    return NextResponse.json({ error: "No such admin" }, { status: 404 });
  }
  // ⚠️ Said in full rather than as "forbidden", because the person reading it
  // is an OWNER doing something reasonable and the refusal looks like a bug
  // unless it explains itself. If this ever succeeded, the only way back into
  // the admin would be somebody running SQL against production by hand.
  return NextResponse.json(
    {
      error:
        "That would leave the shop with no active owner, and nobody could " +
        "grant access again. Make somebody else an owner first.",
      reason: "last-owner",
    },
    { status: 409 },
  );
}
