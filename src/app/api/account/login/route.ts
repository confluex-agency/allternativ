import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signCustomerToken, setCustomerCookie } from "@/lib/customer-auth";
import { authenticateCustomer } from "@/lib/customer-accounts";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = LoginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const ip = getClientIp(request.headers);

    // The same limiter the admin login uses, and the same reasoning: it is a
    // SECURITY control, so it refuses to run in production without Redis
    // rather than quietly leaving password guessing unthrottled.
    const { success } = await loginLimiter.limit(`customer:${ip}:${email}`);
    if (!success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in 15 minutes." },
        { status: 429 },
      );
    }

    const customer = await authenticateCustomer({ email, password });
    if (!customer) {
      // One message for "no such account" and for "wrong password". The shop
      // has a `Customer` row for every guest buyer, so telling the two apart
      // here would answer "has this person bought from us" to anyone asking.
      return NextResponse.json(
        { error: "Those details did not match an account" },
        { status: 401 },
      );
    }

    const token = await signCustomerToken({
      sub: customer.id,
      email: customer.email,
    });
    await setCustomerCookie(token);

    return NextResponse.json({ customer: { email: customer.email } });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
