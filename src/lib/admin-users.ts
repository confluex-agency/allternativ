// Who is staff, what they may do, and who decided that.
//
// Kept out of the routes for the reason `orders-admin.ts` and
// `customers-admin.ts` are: the rules below are the whole feature, and a rule
// that lives inside a route handler is a rule no test can reach. That is not a
// preference — it is how `/api/customers` shipped a payload with password
// hashes in it and kept shipping it through one review.
//
// ── The rule that shapes everything here ────────────────────────────────────
//
// ⚠️ **There is no admin self-registration, and there must never be.**
// `AdminRole` defaults to ANALYTICS_VIEWER, which can read every dashboard in
// the business. A sign-up form would therefore hand the company's numbers to
// anybody who typed an email address. An admin row is created by an OWNER, or
// it does not exist.
//
// So an invitation is the only door, and that invitation is a credential: it
// carries a role somebody already chose. It is treated as one below.

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { AdminRole } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
// Type-only, so importing it pulls none of `auth.ts` runtime (jose,
// next/headers) into this module. `recordAudit` takes the whole payload, and
// matching that keeps one shape for "who did this" across every writer.
import type { JWTPayload } from "@/lib/auth";

const BCRYPT_ROUNDS = 12;

/**
 * How long an invitation link lives.
 *
 * ⚠️ This is the most valuable token the system mints. A password reset returns
 * an account to somebody who already owned it; an invitation **grants access
 * that did not exist before, with a role attached**.
 *
 * It still gets twenty-four hours rather than the reset's three, and the reason
 * is the lesson of 2026-09-12 rather than the threat model. A reset link is
 * expected — the person asked for it seconds earlier. An invitation arrives
 * unannounced, at somebody who was not waiting for it and has no idea it is
 * time-limited at all. A day is what makes "I will do it tonight" work, and the
 * OWNER who sent it can always send another.
 */
export const ADMIN_INVITE_TTL_HOURS = 24;

export interface NewAdminInvite {
  token: string;
  expiresAt: Date;
}

function mintInvite(): NewAdminInvite {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(Date.now() + ADMIN_INVITE_TTL_HOURS * 60 * 60 * 1000),
  };
}

/**
 * ⚠️ Columns that must never leave this module.
 *
 * `passwordHash` and `inviteToken` are secrets, and the second one is
 * *spendable*: whoever reads it can claim that staff account, with its role.
 *
 * Exported so a test can assert their absence as a PROPERTY rather than
 * re-listing the fields it expects — a test that lists them simply agrees with
 * whatever the code happens to do, which is how the equivalent leak on
 * `/api/customers` survived until the day a new column made it a takeover.
 */
export const NEVER_EXPOSED_ADMIN_FIELDS = [
  "passwordHash",
  "inviteToken",
  "inviteExpiresAt",
  "inviteEmailLastError",
  "passwordResetToken",
  "passwordResetExpiresAt",
  "resetEmailLastError",
] as const;

/** The staff list, as the OWNER screen shows it. */
export async function listAdminUsers() {
  const rows = await prisma.adminUser.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      deactivatedAt: true,
      // Enough to answer "why has this person not signed in yet" without
      // exposing the link that would let somebody else do it for them.
      inviteEmailStatus: true,
      inviteEmailSentAt: true,
      invitedByEmail: true,
      createdAt: true,
    },
  });

  // ⚠️ Derived, not selected. The screen needs to know an invitation is still
  // outstanding, and `passwordHash === null` is exactly that fact — but the
  // hash has no business crossing this boundary even to be compared against
  // null, because the next person to add a field to the select above will copy
  // whatever shape they find.
  const unaccepted = await prisma.adminUser.findMany({
    where: { passwordHash: null },
    select: { id: true },
  });
  const unacceptedIds = new Set(unaccepted.map((row) => row.id));

  return rows.map((row) => ({
    ...row,
    hasAccepted: !unacceptedIds.has(row.id),
  }));
}

export type InviteResult =
  | { ok: true; adminUserId: string; invite: NewAdminInvite }
  | { ok: false; reason: "already-exists" };

/**
 * Create a staff account and mint the link that lets somebody claim it.
 *
 * ⚠️ Unlike every customer-facing flow, this one DOES say whether the address
 * is already taken, and that is correct rather than an oversight. The
 * enumeration argument does not apply: the caller is an authenticated OWNER who
 * can read the entire staff list on the same screen. Hiding it from them would
 * buy nothing and produce a silent no-op plus a second invitation nobody ever
 * receives.
 */
export async function inviteAdminUser(input: {
  email: string;
  name: string;
  role: AdminRole;
  invitedBy: JWTPayload;
}): Promise<InviteResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "already-exists" };

  const invite = mintInvite();
  const created = await prisma.adminUser.create({
    data: {
      email,
      name: input.name.trim(),
      role: input.role,
      passwordHash: null,
      inviteToken: invite.token,
      inviteExpiresAt: invite.expiresAt,
      invitedByEmail: input.invitedBy.email,
      inviteEmailStatus: "PENDING",
      inviteEmailAttempts: 0,
      inviteEmailLastError: null,
      // They choose their own password through the link, so there is nothing
      // temporary left for them to change afterwards.
      mustChangePassword: false,
    },
  });

  await recordAudit({
    actor: input.invitedBy,
    action: "create",
    entityType: "admin_user",
    entityId: created.id,
    entityLabel: email,
    newValue: { role: input.role, name: created.name },
  });

  return { ok: true, adminUserId: created.id, invite };
}

export type AcceptResult =
  | { ok: true; adminUserId: string; email: string }
  | { ok: false; reason: "unknown" | "expired" };

/**
 * Spend an invitation and set the password.
 *
 * Mirrors `consumePasswordReset`: the token is cleared in the same write that
 * sets the hash, so the link works exactly once, and `passwordChangedAt` moves
 * so that nothing issued earlier survives.
 */
export async function acceptAdminInvite(
  token: string,
  password: string,
): Promise<AcceptResult> {
  const user = await prisma.adminUser.findUnique({
    where: { inviteToken: token },
    select: { id: true, email: true, inviteExpiresAt: true, isActive: true },
  });
  if (!user) return { ok: false, reason: "unknown" };

  // ⚠️ An invitation to an account somebody has since deactivated is not an
  // invitation any more. Without this line, revoking a mistaken invite would
  // mean racing the recipient's inbox.
  if (!user.isActive) return { ok: false, reason: "unknown" };

  if (user.inviteExpiresAt && user.inviteExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(password, BCRYPT_ROUNDS),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  return { ok: true, adminUserId: user.id, email: user.email };
}

/**
 * ⚠️ The guard that keeps somebody inside the building.
 *
 * OWNER is the only role that can grant roles. So if the last active OWNER is
 * demoted or deactivated, **nobody can ever grant anything again** — and the
 * only way back is a person running SQL against production by hand, which on
 * this hosting means a laptop and the database credentials.
 *
 * It is not hypothetical. There are two ordinary ways to get there: an OWNER
 * tidying up their own account, and an OWNER demoting the *other* OWNER without
 * noticing they were the remaining one.
 *
 * ⚠️ An invited OWNER who has not accepted yet does NOT count as a way out.
 * They cannot sign in, so they cannot grant anything — and treating a pending
 * invitation as cover is how the building gets locked with the key in the post.
 */
async function wouldStrandTheBuilding(targetId: string): Promise<boolean> {
  const owners = await prisma.adminUser.findMany({
    where: { role: "OWNER", isActive: true, passwordHash: { not: null } },
    select: { id: true },
  });
  return owners.length <= 1 && owners.some((owner) => owner.id === targetId);
}

export type RoleChangeResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "last-owner" };

export async function changeAdminRole(input: {
  targetId: string;
  role: AdminRole;
  actor: JWTPayload;
}): Promise<RoleChangeResult> {
  const target = await prisma.adminUser.findUnique({
    where: { id: input.targetId },
    select: { id: true, email: true, role: true, name: true },
  });
  if (!target) return { ok: false, reason: "not-found" };
  if (target.role === input.role) return { ok: true };

  if (input.role !== "OWNER" && (await wouldStrandTheBuilding(target.id))) {
    return { ok: false, reason: "last-owner" };
  }

  await prisma.adminUser.update({
    where: { id: target.id },
    data: { role: input.role },
  });

  // ⚠️ A role change is a commercial act — it is the act that decides who may
  // perform every other commercial act — so it is audited like one. The OLD
  // value is recorded because the question somebody asks later is never "what
  // is this person now", it is "who made them an OWNER, and what were they
  // before".
  await recordAudit({
    actor: input.actor,
    action: "update",
    entityType: "admin_user",
    entityId: target.id,
    entityLabel: target.email,
    oldValue: { role: target.role },
    newValue: { role: input.role },
  });

  return { ok: true };
}

export async function setAdminActive(input: {
  targetId: string;
  isActive: boolean;
  actor: JWTPayload;
}): Promise<RoleChangeResult> {
  const target = await prisma.adminUser.findUnique({
    where: { id: input.targetId },
    select: { id: true, email: true, isActive: true },
  });
  if (!target) return { ok: false, reason: "not-found" };
  if (target.isActive === input.isActive) return { ok: true };

  if (!input.isActive && (await wouldStrandTheBuilding(target.id))) {
    return { ok: false, reason: "last-owner" };
  }

  await prisma.adminUser.update({
    where: { id: target.id },
    data: {
      isActive: input.isActive,
      deactivatedAt: input.isActive ? null : new Date(),
    },
  });

  await recordAudit({
    actor: input.actor,
    action: "update",
    entityType: "admin_user",
    entityId: target.id,
    entityLabel: target.email,
    oldValue: { isActive: target.isActive },
    newValue: { isActive: input.isActive },
  });

  return { ok: true };
}

/**
 * How long a reset link for a STAFF account lives.
 *
 * Two hours, and it sits deliberately between the customer's three and the
 * invitation's twenty-four, because the two constraints pull opposite ways:
 *
 *  * Like the customer reset and unlike an invitation, this one is EXPECTED —
 *    the person clicked "forgot my password" seconds earlier. So the floor from
 *    2026-09-12 is satisfied without a generous window: nobody is surprised by
 *    it hours later.
 *  * Unlike a customer's, the account behind it reads orders, customers and
 *    prices. So it gets less than three hours rather than more.
 *
 * Still eight sweeps of headroom over the postman. See
 * `SWEEP_INTERVAL_MINUTES` in `customer-accounts.ts` for why that floor exists.
 */
export const ADMIN_RESET_TTL_MINUTES = 120;

function mintReset(): NewAdminInvite {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(Date.now() + ADMIN_RESET_TTL_MINUTES * 60 * 1000),
  };
}

/**
 * Mint a reset link for an admin who cannot get in.
 *
 * ⚠️ Returns null when there is nothing to reset, and **the route above must
 * answer identically either way** — same rule as `requestPasswordReset` on the
 * customer side, and it matters more here. A staff login form that distinguished
 * "no such admin" from "wrong password" would let anybody with a browser
 * enumerate who works at this company, which is the first step of every
 * targeted phish. The existing login route already answers the same for all
 * refusals; this must not undo that.
 *
 * Null covers three cases and tells none of them apart: no such address, an
 * invited account that has never had a password (the invitation is the way in,
 * not this), and a deactivated one.
 */
export async function requestAdminPasswordReset(
  rawEmail: string,
): Promise<NewAdminInvite | null> {
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, isActive: true },
  });
  if (!user?.passwordHash) return null;
  if (!user.isActive) return null;

  const reset = mintReset();
  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      passwordResetToken: reset.token,
      passwordResetExpiresAt: reset.expiresAt,
      resetEmailStatus: "PENDING",
      resetEmailAttempts: 0,
      resetEmailLastError: null,
    },
  });
  return reset;
}

/**
 * Spend a reset link and set the new password.
 *
 * Mirrors `acceptAdminInvite` and `consumePasswordReset`: the token is cleared
 * in the same write that sets the hash, and `passwordChangedAt` moves — so every
 * session that existed before this dies, which is the point when the reason for
 * the reset is that somebody else had the old password.
 */
export async function consumeAdminPasswordReset(
  token: string,
  password: string,
): Promise<AcceptResult> {
  const user = await prisma.adminUser.findUnique({
    where: { passwordResetToken: token },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isActive: true,
      passwordResetExpiresAt: true,
    },
  });
  if (!user) return { ok: false, reason: "unknown" };

  // Deactivated between asking and clicking, or a row that lost its password.
  // Neither is an account this link may recreate.
  if (!user.isActive || !user.passwordHash) {
    return { ok: false, reason: "unknown" };
  }

  if (
    user.passwordResetExpiresAt &&
    user.passwordResetExpiresAt.getTime() < Date.now()
  ) {
    return { ok: false, reason: "expired" };
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(password, BCRYPT_ROUNDS),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });

  return { ok: true, adminUserId: user.id, email: user.email };
}

export type ResendResult =
  | { ok: true; kind: "invite" | "reset" }
  | { ok: false; reason: "not-found" | "inactive" };

/**
 * The OWNER's version of the same rescue: send this person a link again.
 *
 * ⚠️ Which link depends on the row, and the caller does not get to choose. An
 * account that never accepted its invitation gets a fresh INVITATION; one that
 * has a password gets a RESET. Letting the screen pick would make it possible
 * to send "you now have access" to somebody who has had it for a month, or a
 * reset to somebody who has never had a password to reset.
 *
 * This exists alongside the self-service form rather than instead of it. The
 * self-service one is what covers the OWNER themselves — if the only way back
 * were another OWNER, then the person who grants access would be the single
 * point of failure for their own account.
 */
export async function resendAdminAccessLink(input: {
  targetId: string;
  actor: JWTPayload;
}): Promise<ResendResult> {
  const target = await prisma.adminUser.findUnique({
    where: { id: input.targetId },
    select: { id: true, email: true, passwordHash: true, isActive: true },
  });
  if (!target) return { ok: false, reason: "not-found" };
  // Deliberately refused rather than silently reactivating: getting access back
  // after it was taken away is a decision, and it is made by the switch that
  // took it away.
  if (!target.isActive) return { ok: false, reason: "inactive" };

  if (target.passwordHash) {
    const reset = mintReset();
    await prisma.adminUser.update({
      where: { id: target.id },
      data: {
        passwordResetToken: reset.token,
        passwordResetExpiresAt: reset.expiresAt,
        resetEmailStatus: "PENDING",
        resetEmailAttempts: 0,
        resetEmailLastError: null,
      },
    });
    await recordAudit({
      actor: input.actor,
      action: "update",
      entityType: "admin_user",
      entityId: target.id,
      entityLabel: target.email,
      newValue: { sent: "password reset link" },
    });
    return { ok: true, kind: "reset" };
  }

  const invite = mintInvite();
  await prisma.adminUser.update({
    where: { id: target.id },
    data: {
      inviteToken: invite.token,
      inviteExpiresAt: invite.expiresAt,
      inviteEmailStatus: "PENDING",
      inviteEmailAttempts: 0,
      inviteEmailLastError: null,
    },
  });
  await recordAudit({
    actor: input.actor,
    action: "update",
    entityType: "admin_user",
    entityId: target.id,
    entityLabel: target.email,
    newValue: { sent: "fresh invitation" },
  });
  return { ok: true, kind: "invite" };
}
