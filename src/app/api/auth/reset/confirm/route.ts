import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeAdminPasswordReset } from "@/lib/admin-users";
import { PasswordSchema } from "@/lib/auth";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

// Spend an admin reset link.
//
// ⚠️ `PasswordSchema` — the ADMIN rule, twelve characters with an upper, a
// lower, a digit and a symbol — not the customer's ten-character one. This
// account reads orders, customers and prices.
//
// ⚠️ Length and composition only. NOT `passwordIsTooCloseToEmail`, for the same
// reason the customer reset leaves it out: that check needs the account's
// address, and a stolen link is precisely the case where its holder may not
// know it. Answering "too close to your email" would hand that address back one
// guess at a time.

const ConfirmSchema = z.object({
  token: z.string().min(1).max(200),
  password: PasswordSchema,
});

export async function POST(request: NextRequest) {
  const parsed = ConfirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error?.issues[0]?.message ?? "Invalid link" },
      { status: 400 },
    );
  }

  const ip = getClientIp(request.headers);
  const { success } = await loginLimiter.limit(`admin-reset-confirm:${ip}`);
  if (!success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in 15 minutes." },
      { status: 429 },
    );
  }

  const result = await consumeAdminPasswordReset(
    parsed.data.token,
    parsed.data.password,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "expired"
            ? "That link has expired. Ask for another from the sign-in page."
            : "That link is not one we issued, or it has already been used.",
        reason: result.reason,
      },
      { status: 400 },
    );
  }

  // Not signed in here — `passwordChangedAt` was just written, and minting a
  // token in the same instant is the `iat`-floor collision `getAuthFromCookies`
  // documents. Same as the invitation and the customer reset.
  return NextResponse.json({ success: true });
}
