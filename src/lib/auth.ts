import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";

const COOKIE_NAME = "allternativ-admin-token";
const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

export interface JWTPayload {
  sub: string; // admin user id
  email: string;
  // The real enum, not a bare string: a typo in a role name should be a compile
  // error, not a silently failing permission check.
  role: AdminRole;
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

const KNOWN_ROLES = Object.values(AdminRole) as string[];

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // The decode is a cast, not a check. Typing `role` as AdminRole would
    // otherwise have the compiler believe something nobody verified: a token
    // carrying `role: "SUPER_ADMIN"` (the enum we retired) would sail through
    // as a valid AdminRole and fail every comparison silently. Forging one
    // needs JWT_SECRET, so this is defence in depth — but it is free, and it
    // makes the type honest.
    if (typeof payload.role !== "string" || !KNOWN_ROLES.includes(payload.role)) {
      return null;
    }

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

/**
 * Result of an authorisation check.
 *
 * 401 and 403 are kept apart on purpose. "You are not signed in" and "you are
 * signed in but this is not yours" are different situations: they need
 * different handling in the UI, and collapsing them makes a permission bug
 * indistinguishable from an expired session when something goes wrong.
 */
export type AuthResult =
  | { ok: true; user: JWTPayload }
  | { ok: false; status: 401 | 403 };

/**
 * The single place a role is checked.
 *
 * This used to be copied inline in three route files as a `new Set([...])`,
 * which is how `/api/orders` and `/api/customers` ended up with no check at all:
 * there was nothing to forget to import.
 *
 * Builds on getAuthFromCookies(), so it inherits the rule that a token issued
 * before the user's last password change is dead.
 */
export async function requireRole(
  ...allowed: AdminRole[]
): Promise<AuthResult> {
  const user = await getAuthFromCookies();
  if (!user) return { ok: false, status: 401 };
  if (!allowed.includes(user.role)) return { ok: false, status: 403 };
  return { ok: true, user };
}

/** Roles that may see commercial data: orders, customers, money. */
export const COMMERCIAL_ROLES: AdminRole[] = ["OWNER", "ECOMMERCE_ADMIN"];

/**
 * Roles that may read dashboards. All of them — ANALYTICS_VIEWER exists for
 * exactly this and nothing else (section 18 of the client brief).
 */
export const REPORTING_ROLES: AdminRole[] = [
  "OWNER",
  "ECOMMERCE_ADMIN",
  "CONTENT_ADMIN",
  "ANALYTICS_VIEWER",
];

export { COOKIE_NAME };
