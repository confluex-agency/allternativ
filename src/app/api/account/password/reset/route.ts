import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/customer-accounts";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

const RequestSchema = z.object({ email: z.string().email().max(254) });

/**
 * Ask for a reset link.
 *
 * ⚠️ **This route answers the same thing to everybody, always.** Whether the
 * address has an account, has only ever bought as a guest, or has never been
 * seen here, the reply is `{ queued: true }` and the status is 200. Anything
 * else — a different status, a different message, a measurably different
 * response time — turns an endpoint that takes an email address and needs no
 * credentials into an account-enumeration oracle.
 *
 * That is why `requestPasswordReset` returning null is deliberately not looked
 * at here. There is nothing to branch on, so nobody can later add a branch by
 * accident.
 *
 * ⚠️ It is rate-limited on TWO keys, and dropping either one leaves a real
 * hole:
 *
 *   * by address, because without it one attacker can mail-bomb one person's
 *     inbox with reset requests from anywhere — the mail is our name in their
 *     mailbox, so this is our problem and not only theirs;
 *   * by IP, because without it a single machine can walk a list of addresses
 *     and time the replies.
 *
 * Both use `loginLimiter`, which is `critical` and therefore refuses to run in
 * production without Redis. Correct for this route: an unthrottled reset
 * endpoint is a mail cannon, and failing open would be the wrong trade.
 */
export async function POST(request: NextRequest) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));

  // Even a malformed address gets the neutral answer rather than a validation
  // complaint. "That is not an email" and "no account here" are different
  // sentences, and only one of them is safe to say.
  if (!parsed.success) return NextResponse.json({ queued: true });

  const email = parsed.data.email.trim().toLowerCase();
  const ip = getClientIp(request.headers);

  const perAddress = await loginLimiter.limit(`reset-request:${email}`);
  const perIp = await loginLimiter.limit(`reset-request-ip:${ip}`);
  if (!perAddress.success || !perIp.success) {
    // ⚠️ Even this is the same for everybody. A 429 that only ever appeared for
    // real accounts would be the oracle again, wearing a different number.
    return NextResponse.json(
      { error: "Too many attempts. Please try again in 15 minutes." },
      { status: 429 },
    );
  }

  await requestPasswordReset(email);

  return NextResponse.json({ queued: true });
}
