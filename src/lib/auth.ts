import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "allternativ-admin-token";
const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

export interface JWTPayload {
  sub: string; // admin user id
  email: string;
  role: string;
  name: string;
  iat?: number;
  exp?: number;
}

export const PasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(200, "Password too long")
  .refine((p) => /[a-z]/.test(p), "Must contain a lowercase letter")
  .refine((p) => /[A-Z]/.test(p), "Must contain an uppercase letter")
  .refine((p) => /\d/.test(p), "Must contain a digit")
  .refine((p) => /[^a-zA-Z0-9]/.test(p), "Must contain a special character");

export async function signToken(
  payload: Omit<JWTPayload, "iat" | "exp">,
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function removeAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Validates signature AND that the token was issued after the user's
// last password change (rejects stale tokens after password reset).
export async function getAuthFromCookies(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.iat) return null;

  const user = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { passwordChangedAt: true },
  });
  if (!user) return null;

  const tokenIssuedMs = payload.iat * 1000;
  if (
    user.passwordChangedAt &&
    tokenIssuedMs < user.passwordChangedAt.getTime()
  ) {
    return null;
  }

  return payload;
}

export { COOKIE_NAME };
