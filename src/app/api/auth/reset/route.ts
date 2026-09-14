import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestAdminPasswordReset } from "@/lib/admin-users";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

// "I cannot get into the admin."
//
// ⚠️ **This route answers the same thing to everybody, always** — 200
// `{queued:true}`, whether the address belongs to an admin, to an invited
// account that never set a password, to a deactivated one, or to nobody.
//
// It matters more here than on the customer side. A staff endpoint that told
// those apart would let anybody with a browser enumerate **who works at this
// company**, which is the first step of every targeted phish — and the login
// route already refuses all its cases identically, so a difference here would
// give back exactly what that was protecting.
//
// `requestAdminPasswordReset` returning null is therefore deliberately not
// looked at: there is nothing to branch on, so nobody can add a branch later.

const RequestSchema = z.object({ email: z.string().email().max(254) });

export async function POST(request: NextRequest) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));

  // Even a malformed address gets the neutral answer rather than a validation
  // complaint: "that is not an email" and "no admin here" are different
  // sentences and only one is safe to say.
  if (!parsed.success) return NextResponse.json({ queued: true });

  const email = parsed.data.email.trim().toLowerCase();
  const ip = getClientIp(request.headers);

  // Two keys, same reasoning as the customer reset: by address so one attacker
  // cannot mail-bomb one person in our name, by IP so one machine cannot walk a
  // list. `loginLimiter` is `critical`, so it refuses to run in production
  // without Redis — correct for an unauthenticated endpoint that sends mail.
  const perAddress = await loginLimiter.limit(`admin-reset:${email}`);
  const perIp = await loginLimiter.limit(`admin-reset-ip:${ip}`);
  if (!perAddress.success || !perIp.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in 15 minutes." },
      { status: 429 },
    );
  }

  await requestAdminPasswordReset(email);

  return NextResponse.json({ queued: true });
}
