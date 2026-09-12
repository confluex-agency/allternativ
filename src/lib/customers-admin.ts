// What the admin may read about a customer, named column by column.
//
// Kept out of the route for the same reason `orders-admin.ts` and
// `customer-accounts.ts` are: the rule below is the whole point and it needs
// to be testable without a server. That is not an abstract preference here —
// this query lived inline in `/api/customers` and drifted precisely because
// nothing could reach it to check.
//
// ── The rule ────────────────────────────────────────────────────────────────
//
// ⚠️ **`include` without `select` returns EVERY SCALAR COLUMN**, not only the
// relations it names. That is the trap this file exists to close. The admin
// order list was fixed for exactly this on 2026-09-11; the customer list was
// one route over and was not, so it kept answering with `password_hash` and
// `email_verification_token` attached to every row.
//
// ⚠️ On 2026-09-12 that stopped being a disclosure and became an account
// takeover, because password reset added `password_reset_token`. A verification
// token only proves an address; a reset token **is the account** —
// `POST /api/account/password/reset/confirm` accepts it from anybody, with no
// session at all, sets a password of the caller's choosing and stamps
// `emailVerifiedAt`, which opens that person's order history, name and phone.
// Every customer who had clicked "Forgotten your password?" within the hour
// would have been listed here with a live one.
//
// So the shape below is a WHITELIST, and the point of a whitelist is what it
// does to the future: a column added to `Customer` tomorrow does not appear in
// this payload until somebody decides it should. The failure above happened
// because a new column was published by a route nobody thought to re-read.

import { prisma } from "@/lib/prisma";

/**
 * Columns that must never leave this module, whatever else changes.
 *
 * Two kinds, and they are different sizes of mistake:
 *
 *   * `passwordHash`, `emailVerificationToken`, `passwordResetToken` — secrets.
 *     The last one is spendable by anybody who reads it.
 *   * `passwordResetExpiresAt`, `emailVerificationExpiresAt` — not secrets, but
 *     they describe a link that is in flight and there is no reason to publish
 *     that. `verifyEmailStatus` and `resetEmailStatus` already answer the
 *     question support actually asks.
 *   * `verifyEmailLastError`, `resetEmailLastError` — a mail provider's own
 *     message, which belongs in the sweep's output and not in a customer list.
 *
 * Exported so the test can assert the property rather than re-listing the
 * fields it expects and quietly agreeing with whatever the code does.
 */
export const NEVER_EXPOSED_CUSTOMER_FIELDS = [
  "passwordHash",
  "emailVerificationToken",
  "emailVerificationExpiresAt",
  "passwordResetToken",
  "passwordResetExpiresAt",
  "verifyEmailLastError",
  "resetEmailLastError",
] as const;

const ADMIN_CUSTOMER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  country: true,
  city: true,
  orderCount: true,
  totalSpentCents: true,
  // Dates and enum states: what support needs to answer "why can this person
  // not see their own orders". No token, no hash, no provider message.
  emailVerifiedAt: true,
  verifyEmailStatus: true,
  resetEmailStatus: true,
  marketingConsent: true,
  marketingConsentAt: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { orders: true } },
} as const;

export async function listCustomersForAdmin(input: {
  page: number;
  pageSize: number;
}) {
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: input.pageSize,
      skip: (input.page - 1) * input.pageSize,
      select: ADMIN_CUSTOMER_SELECT,
    }),
    prisma.customer.count(),
  ]);

  return { customers, total };
}
