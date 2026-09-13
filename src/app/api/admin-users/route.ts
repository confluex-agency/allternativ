import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { listAdminUsers, inviteAdminUser } from "@/lib/admin-users";

// ⚠️ OWNER and nothing else, on both verbs.
//
// This is the route that decides who may use every other route, so it is the
// one place where `COMMERCIAL_ROLES` would be exactly wrong: an ECOMMERCE_ADMIN
// who could invite would simply invite themselves a second account as OWNER,
// and the role system would be decoration. Section 18 puts users under OWNER
// for this reason.
//
// Written as `requireRole("OWNER")` rather than a new one-element list in
// `roles.ts`, because a named set invites somebody to add a role to it.

const InviteSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().min(1).max(120),
  // The enum is the control. A role that is not on this list cannot be
  // expressed by any request, whatever the screen offers.
  role: z.enum(["OWNER", "ECOMMERCE_ADMIN", "CONTENT_ADMIN", "ANALYTICS_VIEWER"]),
});

export async function GET() {
  const auth = await requireRole("OWNER");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  return NextResponse.json({ users: await listAdminUsers() });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole("OWNER");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const parsed = InviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error?.issues[0]?.message ?? "Invalid details" },
      { status: 400 },
    );
  }

  const result = await inviteAdminUser({
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role,
    invitedBy: auth.user,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "There is already an admin with that email address." },
      { status: 409 },
    );
  }

  // ⚠️ The token is NOT returned. It goes out by email and only by email.
  //
  // Handing it back here would be convenient — the OWNER could paste the link
  // into a chat — and it would quietly undo the point of sending it to the
  // address: that accepting proves the person controls the mailbox the account
  // is named after. A link pasted into a group chat proves nothing and lives
  // there for ever.
  return NextResponse.json({ invited: true, queued: true });
}
