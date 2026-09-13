import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";

const COOKIE_NAME = "allternativ-admin-token";
const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

/**
 * Which of the two token systems this one is.
 *
 * ⚠️ Customers now sign in too (`src/lib/customer-auth.ts`), and both sides
 * sign with the SAME `JWT_SECRET`. Different cookie names already keep them
 * apart in normal operation, but a cookie name is not a security boundary: it
 * is a string an attacker who can set cookies chooses. Without this claim, a
 * customer's own valid token dropped into the admin cookie would verify.
 *
 * It is checked on both sides, so neither token is accepted by the other.
 *
 * ⚠️ Admin tokens issued before this shipped carry no `typ` and are therefore
 * rejected: everyone signed in at deploy time is signed out once. That is the
 * whole cost, and it is the right way round — accepting a token because it is
 * old is how this kind of check gets hollowed out.
 */
export const ADMIN_TOKEN_TYPE = "admin";

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
  return new SignJWT({
    ...(payload as unknown as Record<string, unknown>),
    typ: ADMIN_TOKEN_TYPE,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

const KNOWN_ROLES = Object.values(AdminRole) as string[];

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // A customer's token is signed with the same secret, so the signature
    // alone does not say which system issued this. See ADMIN_TOKEN_TYPE.
    if (payload.typ !== ADMIN_TOKEN_TYPE) return null;

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
    select: { passwordChangedAt: true, role: true, isActive: true },
  });
  if (!user) return null;

  // ⚠️ Access taken away has to stop working NOW, not when the cookie expires.
  // Deactivating somebody who is signed in is the case this exists for — it is
  // the one time anybody deactivates an account in a hurry.
  if (!user.isActive) return null;

  // ⚠️ The second of tolerance is not slack, it is the unit `iat` is measured
  // in — and without it this check fires on the very token it is meant to
  // bless. A JWT's issued-at is whole SECONDS, floored; `passwordChangedAt` is
  // a millisecond timestamp. `/api/auth/change-password` writes the timestamp
  // and then signs a replacement token, whose `iat` floors back to the start of
  // that same second and therefore lands BEFORE it — so the fresh token was
  // dead on arrival roughly whenever the change did not happen exactly on a
  // second boundary.
  //
  // The symptom was quiet enough to live with for a while: change your
  // password, get bounced to the login page, sign in again with the new one,
  // and assume that is how it works.
  const tokenIssuedMs = payload.iat * 1000 + 999;
  if (
    user.passwordChangedAt &&
    tokenIssuedMs < user.passwordChangedAt.getTime()
  ) {
    return null;
  }

  // ⚠️ **The role comes from the ROW, never from the token**, and this line is
  // newer than the rest of this function for a reason worth keeping.
  //
  // A JWT is a snapshot of what was true when it was signed. That was harmless
  // while roles never changed — there was exactly one admin, made by the seed,
  // and `role` was effectively a constant. The moment an OWNER can change
  // somebody's role, the token's copy is **stale and authoritative at the same
  // time**, which is the worst combination: demote somebody from OWNER and
  // their cookie keeps saying OWNER for up to seven days, across every
  // `requireRole` check in the app.
  //
  // The database read is already happening two lines up for `passwordChangedAt`,
  // so reading the live role costs nothing. A promotion takes effect on the next
  // request, a demotion likewise, and neither signs anybody out — which also
  // means an OWNER fixing a role they mis-clicked does not have to explain to
  // somebody why they were logged out.
  return { ...payload, role: user.role };
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

// The role sets moved to `roles.ts`, which has no server-only imports, so the
// admin sidebar can decide whether to offer a link without pulling `jose`,
// `next/headers` and Prisma into the browser. Re-exported here because every
// API route already reads them from this module beside `requireRole`.
export { COMMERCIAL_ROLES, REPORTING_ROLES } from "@/lib/roles";

export { COOKIE_NAME };
