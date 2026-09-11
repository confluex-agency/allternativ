import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeVerificationToken } from "@/lib/customer-accounts";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

const VerifySchema = z.object({ token: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  const parsed = VerifySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  // Thirty-two random bytes are not guessable, but a link that opens somebody's
  // order history should not be something you may try at unlimited speed
  // either. Keyed by address, since the token is what is being guessed.
  const ip = getClientIp(request.headers);
  const { success } = await loginLimiter.limit(`verify:${ip}`);
  if (!success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in 15 minutes." },
      { status: 429 },
    );
  }

  const result = await consumeVerificationToken(parsed.data.token);
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "expired"
            ? "That link has expired. Ask for a new one from your account."
            : "That link is not one we issued, or it has already been used.",
        reason: result.reason,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, email: result.email });
}
