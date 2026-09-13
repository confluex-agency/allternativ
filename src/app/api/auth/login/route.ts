import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie } from "@/lib/auth";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const parsed = LoginSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    const { success } = await loginLimiter.limit(`${ip}:${email}`);
    if (!success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in 15 minutes." },
        { status: 429 },
      );
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });

    // ⚠️ Three refusals that all answer the same thing on purpose, because
    // telling them apart would say more about the staff list than a stranger at
    // the login form should learn:
    //
    //   * no such admin;
    //   * invited but has never set a password (`passwordHash` is null) — the
    //     invitation link is the only way in, and this form is not it;
    //   * deactivated. ⚠️ This one is the reason the check is HERE and not only
    //     in the guard: taking somebody's access away has to stop them signing
    //     in again, not merely expire what they already held.
    //
    // The wrong password lands in the same place, as it always did.
    if (
      !user ||
      !user.isActive ||
      !user.passwordHash ||
      !(await compare(password, user.passwordHash))
    ) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
