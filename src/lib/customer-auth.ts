// Who the shopper is, kept deliberately apart from who the staff are.
//
// ── Why this is a second file and not a flag on the first ───────────────────
//
// `src/lib/auth.ts` answers "which member of staff is this, and what are they
// allowed to edit". This answers "which customer is this". They look alike —
// a bcrypt hash, a JWT, an HttpOnly cookie — and that resemblance is exactly
// the reason to keep them apart: the day somebody adds a role to one of them,
// or relaxes a password rule, or widens a lookup, they must not be able to do
// it to both by accident. An admin session is a key to the commercial data of
// the business; a customer session is a key to one person's own orders.
//
// Three things keep them from meeting:
//
//   1. A different cookie. Nothing reads both.
//   2. A `typ` claim inside the token, checked on both sides, because a cookie
//      name is chosen by whoever sets the cookie and both are signed with the
//      same `JWT_SECRET`. See `ADMIN_TOKEN_TYPE` in `auth.ts`.
//   3. A different table. A customer is a `Customer`, never an `AdminUser`,
//      and no code path here can return one.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "allternativ-customer-token";
const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

/** The other half of the pair described in `auth.ts`. */
export const CUSTOMER_TOKEN_TYPE = "customer";

/** Seven days, matching the admin session. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface CustomerTokenPayload {
  sub: string; // customer id
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * What a shopper's password has to be, and why it is not the admin's rule.
 *
 * `PasswordSchema` in `auth.ts` demands twelve characters with an upper, a
 * lower, a digit and a symbol. That is right for an account that can read the
 * customer list and change prices, and wrong here.
 *
 * Composition rules of that kind do not buy strength from the public — they
 * buy `Sunglasses1!`, written on a card, and a support email every time
 * somebody cannot get back in. Length is what actually costs an attacker
 * something, so length is what is asked for. The rate limiter on the login
 * route is doing the real work against guessing.
 *
 * The one content rule is the one that catches a genuinely dead password:
 * the address itself, which is the first thing anybody tries.
 */
export const CustomerPasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "That password is too long");

/** Rejects a password that is just the address it protects. */
export function passwordIsTooCloseToEmail(
  password: string,
  email: string,
): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const lowered = password.toLowerCase();
  if (local.length >= 3 && lowered.includes(local)) return true;
  return lowered.includes(email.toLowerCase());
}

export async function signCustomerToken(
  payload: Pick<CustomerTokenPayload, "sub" | "email">,
): Promise<string> {
  return new SignJWT({ ...payload, typ: CUSTOMER_TOKEN_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyCustomerToken(
  token: string,
): Promise<CustomerTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.typ !== CUSTOMER_TOKEN_TYPE) return null;
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return payload as unknown as CustomerTokenPayload;
  } catch {
    return null;
  }
}

export async function setCustomerCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    // ⚠️ `lax`, not the admin's `strict`, and the difference is deliberate.
    //
    // A shopper comes back to this site from somewhere else all the time —
    // most importantly from Stripe's hosted checkout page, which is a
    // cross-site navigation. Under `strict` the cookie is withheld on that
    // first request, so a signed-in buyer would land on `/checkout/success`
    // looking signed out. `lax` still withholds it on cross-site POSTs, which
    // is the CSRF case that matters.
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function removeCustomerCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** What a signed-in shopper is, everywhere above this file. */
export interface SignedInCustomer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  emailVerified: boolean;
  marketingConsent: boolean;
}

/**
 * The signed-in customer, or null.
 *
 * Verifies the signature AND re-reads the row, for the same reason the admin
 * side does: a token has to stop working when the password behind it changes,
 * and a token cannot know that on its own.
 */
export async function getCustomerFromCookies(): Promise<SignedInCustomer | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyCustomerToken(token);
  if (!payload?.iat) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      passwordHash: true,
      passwordChangedAt: true,
      emailVerifiedAt: true,
      marketingConsent: true,
    },
  });
  if (!customer) return null;

  // A row whose password was removed is not an account any more. Guest rows
  // have never had one, and a token for one should not exist — but if it ever
  // did, this is where it stops.
  if (!customer.passwordHash) return null;

  // ⚠️ The second of tolerance is not slack, it is the unit `iat` is measured
  // in. A JWT's issued-at is whole SECONDS, floored, while `passwordChangedAt`
  // is a millisecond timestamp — so a token signed in the same breath as the
  // password it belongs to can carry an `iat` up to 999ms EARLIER than the
  // change it was issued for. Comparing them raw signs the person out at the
  // moment they register, or the instant they change their password, and the
  // symptom is a login that appears to succeed and then does not.
  const issuedAtMs = payload.iat * 1000 + 999;
  if (
    customer.passwordChangedAt &&
    issuedAtMs < customer.passwordChangedAt.getTime()
  ) {
    return null;
  }

  const emailVerified = customer.emailVerifiedAt !== null;

  // ⚠️ `name` and `phone` are withheld until the address is proved, and this is
  // the same gate `listCustomerOrders` applies — deliberately in the same one
  // place, not re-remembered per route.
  //
  // The first version of this gated ONLY the order history, and that was a
  // hole a security review found. A `Customer` row is created by the Stripe
  // webhook for every guest buyer, and the webhook writes the BUYER'S OWN name
  // and phone into it from `session.customer_details`. Registration adopts any
  // row that has no password — which is every guest row — and signed the
  // registrant straight in. So `GET /api/account/me` answered with a real
  // person's name and phone number to anybody who typed their email address
  // and any ten characters.
  //
  // It also leaked the fact the gate existed to stop leaking: a blank name and
  // phone meant "this address has never bought", a filled one meant it had.
  // Scriptable against any list of addresses.
  //
  // The cost of withholding is that somebody who has just signed up does not
  // see their own name back until they click the link. That is a small price
  // for a rule with no exceptions to forget.
  return {
    id: customer.id,
    email: customer.email,
    name: emailVerified ? customer.name : null,
    phone: emailVerified ? customer.phone : null,
    emailVerified,
    marketingConsent: customer.marketingConsent,
  };
}

export type CustomerAuthResult =
  | { ok: true; customer: SignedInCustomer }
  | { ok: false; status: 401 };

/**
 * The single place an API route asks "is somebody signed in".
 *
 * There is no 403 here, and there is no role. A customer is either themselves
 * or nobody; every query below this point is filtered by `customer.id`, so
 * there is nothing to be authorised *for*.
 */
export async function requireCustomer(): Promise<CustomerAuthResult> {
  const customer = await getCustomerFromCookies();
  if (!customer) return { ok: false, status: 401 };
  return { ok: true, customer };
}

/**
 * The same guard for a PAGE, which redirects rather than returning a status.
 *
 * `next` carries the address back to the login form, so signing in lands where
 * the person was going instead of dumping them on the account home.
 */
export async function requireCustomerPage(
  next?: string,
): Promise<SignedInCustomer> {
  const customer = await getCustomerFromCookies();
  if (!customer) {
    const target = next
      ? `/account/login?next=${encodeURIComponent(next)}`
      : "/account/login";
    redirect(target);
  }
  return customer;
}

export { COOKIE_NAME as CUSTOMER_COOKIE_NAME };
