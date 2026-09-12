import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumePasswordReset } from "@/lib/customer-accounts";
import { CustomerPasswordSchema } from "@/lib/customer-auth";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

// ⚠️ Length only, and NOT `passwordIsTooCloseToEmail` — which registration does
// apply. The asymmetry is deliberate and it took a second look to see why.
//
// That check needs the account's email address, and this is the one flow where
// the person on the other end may not know it. A stolen or forwarded reset link
// lets its holder SET a password; it does not let them sign in, because signing
// in also needs the address. So here the address is a secret the token does not
// carry — and answering "that password is too close to your email" would leak
// bits of it back, one guess at a time, to exactly the holder it is being kept
// from.
//
// The rule that actually costs an attacker something is length, and length
// needs nothing but the password itself.
const ConfirmSchema = z.object({
  token: z.string().min(1).max(200),
  password: CustomerPasswordSchema,
});

/**
 * Spend a reset link and set the new password.
 *
 * ⚠️ **It does not sign the person in afterwards**, and that is not an
 * oversight to tidy up later. `consumePasswordReset` moves
 * `passwordChangedAt`, which is what kills the session of anybody who was
 * holding this account before — the attacker, in the case this flow exists
 * for. Issuing a fresh cookie here would mean minting a token in the same
 * instant that timestamp is written, which is the exact `iat`-floor collision
 * `getCustomerFromCookies` documents. Sending them to the login form costs one
 * screen and relies on nothing subtle.
 *
 * It also matches what verifying does, and for a shopper the two now behave
 * alike: click the link, then sign in.
 */
export async function POST(request: NextRequest) {
  const parsed = ConfirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error?.issues[0]?.message ?? "Invalid link" },
      { status: 400 },
    );
  }

  // Thirty-two random bytes are not guessable, but the thing on the other side
  // of this token is the account itself, so it is not something anybody may
  // try at unlimited speed either. Same reasoning as the verify route.
  const ip = getClientIp(request.headers);
  const { success } = await loginLimiter.limit(`reset-confirm:${ip}`);
  if (!success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in 15 minutes." },
      { status: 429 },
    );
  }

  const result = await consumePasswordReset(
    parsed.data.token,
    parsed.data.password,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "expired"
            ? "That link has expired. Reset links last about an hour — ask for a new one."
            : "That link is not one we issued, or it has already been used.",
        reason: result.reason,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
