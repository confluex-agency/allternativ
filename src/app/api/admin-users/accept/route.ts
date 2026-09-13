import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { acceptAdminInvite } from "@/lib/admin-users";
import { PasswordSchema } from "@/lib/auth";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

// Claim a staff account with the link that was emailed.
//
// ⚠️ The only route in this folder that is NOT behind `requireRole`, and
// necessarily so: the person accepting has no session yet — that is the whole
// point of the invitation. The token is the credential, and it is a good one:
// 32 random bytes, single use, twenty-four hours, and cleared in the same write
// that sets the password.
//
// ⚠️ `PasswordSchema`, the ADMIN rule — twelve characters with an upper, a
// lower, a digit and a symbol — not the customer's ten-character one. The
// asymmetry is the same one `customer-auth.ts` argues for in reverse: this
// account can read the customer list and change prices, and composition rules
// are worth their friction on an account that small a number of people hold.

const AcceptSchema = z.object({
  token: z.string().min(1).max(200),
  password: PasswordSchema,
});

export async function POST(request: NextRequest) {
  const parsed = AcceptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error?.issues[0]?.message ?? "Invalid link" },
      { status: 400 },
    );
  }

  // The token is not guessable, but the thing behind it is a staff account, so
  // it is not something anybody may try at unlimited speed either. Same
  // reasoning as the customer verify and reset routes.
  const ip = getClientIp(request.headers);
  const { success } = await loginLimiter.limit(`admin-accept:${ip}`);
  if (!success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in 15 minutes." },
      { status: 429 },
    );
  }

  const result = await acceptAdminInvite(parsed.data.token, parsed.data.password);

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "expired"
            ? "That invitation has expired. Ask whoever invited you to send another."
            : "That invitation is not one we issued, or it has already been used.",
        reason: result.reason,
      },
      { status: 400 },
    );
  }

  // ⚠️ Not signed in here, deliberately, and for the same reason the customer
  // reset is not: `acceptAdminInvite` has just written `passwordChangedAt`, and
  // minting a token in that same instant is the `iat`-floor collision
  // `getAuthFromCookies` documents. One more screen costs nothing.
  return NextResponse.json({ success: true, email: result.email });
}
