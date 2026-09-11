import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CustomerPasswordSchema,
  passwordIsTooCloseToEmail,
  signCustomerToken,
  setCustomerCookie,
} from "@/lib/customer-auth";
import { registerCustomer } from "@/lib/customer-accounts";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: CustomerPasswordSchema,
  name: z.string().max(120).optional(),
  // Section 25: an account is not consent. It arrives from a checkbox that is
  // off by default, or it does not arrive.
  marketingConsent: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = RegisterSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid details" },
        { status: 400 },
      );
    }

    const { email, password, name, marketingConsent } = parsed.data;

    if (passwordIsTooCloseToEmail(password, email)) {
      return NextResponse.json(
        { error: "Choose a password that is not your email address" },
        { status: 400 },
      );
    }

    // Keyed on the ADDRESS this came from, not on the email. Keying by email
    // would limit nothing here: an attacker making accounts in bulk supplies a
    // different one every time.
    const ip = getClientIp(request.headers);
    const { success } = await loginLimiter.limit(`register:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in 15 minutes." },
        { status: 429 },
      );
    }

    const result = await registerCustomer({
      email,
      password,
      name: name ?? null,
      marketingConsent,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "An account already exists for that email. Try signing in." },
        { status: 409 },
      );
    }

    // Signed in straight away, deliberately. The account is usable — details,
    // consent, a place to come back to — and only ORDER HISTORY waits for the
    // address to be proved. Making somebody verify before they can even see
    // the page they just created would be a worse trade for the same safety.
    const token = await signCustomerToken({
      sub: result.customerId,
      email: result.email,
    });
    await setCustomerCookie(token);

    return NextResponse.json({
      customer: { email: result.email, emailVerified: false },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
