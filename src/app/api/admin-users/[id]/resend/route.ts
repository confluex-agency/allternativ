import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { resendAdminAccessLink } from "@/lib/admin-users";

// The OWNER's rescue: send this person their link again.
//
// ⚠️ Which link it is, is decided by the ROW and not by the caller — an account
// that never accepted gets a fresh invitation, one that has a password gets a
// reset. See `resendAdminAccessLink`. Letting the screen choose would make it
// possible to tell somebody who has had access for a month that they have just
// been granted it.

export async function POST(
  _request: Request,
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
  const result = await resendAdminAccessLink({ targetId: id, actor: auth.user });

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "inactive"
            ? "That account is deactivated. Reactivate it first — getting access back is a decision, not a side effect of sending an email."
            : "No such admin",
      },
      { status: result.reason === "inactive" ? 409 : 404 },
    );
  }

  return NextResponse.json({ sent: result.kind });
}
