// What a customer account can actually do, kept out of the route handlers.
//
// The routes under `src/app/api/account/` are transport: parse, rate-limit,
// set a cookie, return a status. Everything that decides anything lives here,
// for the same reason `process-stripe-event.ts` lives outside its webhook —
// it can then be tested without a server, and there is one copy of each rule.
//
// ── The rule that matters most ──────────────────────────────────────────────
//
// ⚠️ A `Customer` row is NOT created by signing up. It is created by the Stripe
// webhook, for every guest buyer, keyed on the email they paid with. By the
// time anybody registers, that row may already hold their order history, their
// shipping address and their phone number.
//
// So "register" is usually "put a password on an existing row", and if that
// were enough to read the row, then knowing somebody's email address would be
// enough to read what they bought and where it was sent. It is not enough:
// `emailVerifiedAt` gates order history, and only a link sent to the address
// itself sets it.
//
// The cost of that is stated plainly because it is real: **until a mail
// provider is configured, nobody can verify**, so accounts can be created and
// used but order history stays closed. That is the same gap the order
// confirmations are already sitting in, and the sweep shouts about both.

import { randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

// ── Why the verification token is stored as it is sent ──────────────────────
//
// The instinct is to keep a hash of it, the way a password is kept. It would be
// decoration here, and the reason is structural rather than a judgement call:
// **the database is the outbox**. The mail is queued on the row and drained by
// the sweep minutes or days later, so the row has to be able to produce the
// link at send time — which means holding the value, not a fingerprint of it.
//
// Hashing it as well, in the same row, protects nothing: the attacker it would
// defend against is one who can read `customers`, and that attacker can already
// read the order history the token exists to protect.
//
// What does limit the exposure is lifetime, so that is where the effort goes:
// 32 random bytes, a hard expiry, and the column cleared in the same write that
// marks the address proven. A spent link is not a weaker credential, it is not
// a credential.

/** Cost factor, matching the admin seed. */
const BCRYPT_ROUNDS = 12;

/**
 * How long a verification link lives.
 *
 * Longer than the twenty-four hours a bank would give, because this link is
 * not a password reset: the worst it can do is mark an address proven. It has
 * to survive a weekend, a spam folder and a sweep that runs every fifteen
 * minutes but only drains mail once a provider exists.
 */
export const VERIFICATION_TTL_HOURS = 72;

export interface NewVerification {
  /** The value that goes in the link. */
  token: string;
  expiresAt: Date;
}

function mintVerification(): NewVerification {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000),
  };
}

/**
 * What the host's cron is set to for `sweep`.
 *
 * Nothing reads this. It is here so the reset lifetime below can be justified
 * against a real number rather than a feeling, and so that shortening that
 * lifetime past the interval fails a test instead of failing a customer.
 */
export const SWEEP_INTERVAL_MINUTES = 15;

/**
 * How long a password reset link lives — and why it is minutes, not the
 * seventy-two hours its sibling above gets.
 *
 * The two links are not the same kind of object. A verification link can only
 * ever mark an address proven; the worst a stolen one does is open a history to
 * somebody who already had the mailbox it was sent to. **A reset link IS the
 * account**: whoever holds it chooses the password. So it gets a credential's
 * lifetime, not a courtesy's.
 *
 * ⚠️ It cannot simply be as short as possible, and the floor is peculiar to how
 * this shop sends mail. **The database is the outbox and the sweep is the
 * postman**, so a link is minted now and posted up to `SWEEP_INTERVAL_MINUTES`
 * later. A lifetime near that interval would mail people links that had already
 * expired in the queue — the cruellest possible failure, because it looks like
 * the shop is broken and the person has no way to tell it from a typo.
 *
 * Sixty minutes is four sweeps of headroom, leaves the recipient forty-five
 * minutes in the worst case, and is the figure a bank would recognise.
 */
export const PASSWORD_RESET_TTL_MINUTES = 60;

export interface NewPasswordReset {
  token: string;
  expiresAt: Date;
}

function mintPasswordReset(): NewPasswordReset {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
  };
}

export type RegisterResult =
  | { ok: true; customerId: string; email: string; verification: NewVerification }
  | { ok: false; reason: "already-registered" };

/**
 * Create the account, or put a password on the row a guest checkout left.
 *
 * ⚠️ `already-registered` leaks one bit: whether this address has an account.
 * That much is the honest trade — the answer is identical for an address
 * nobody has heard of and for one that has bought six pairs as a guest,
 * because a guest row has no password. It says "someone signed up", not
 * "someone bought".
 *
 * ⚠️ An earlier version of this comment stopped there, and it was wrong in a
 * way worth keeping written down. Adopting the row was only half the story:
 * the registrant was then signed in and handed the row's `name` and `phone` —
 * the BUYER's, written by the Stripe webhook. So the reply did distinguish a
 * guest buyer from a stranger after all, by whether those fields came back
 * filled, and it handed over the PII while it was at it. The gate was on the
 * order history and nowhere else.
 *
 * It is closed in `getCustomerFromCookies`, which now withholds `name` and
 * `phone` until `emailVerifiedAt` is set, and in `updateCustomerProfile`,
 * which will not let an unproved registrant overwrite them. The lesson is the
 * one this file already claimed to follow: the gate belongs in one place that
 * every path goes through, not on the one field somebody remembered.
 */
export async function registerCustomer(input: {
  email: string;
  password: string;
  name?: string | null;
  marketingConsent?: boolean;
}): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (existing?.passwordHash) return { ok: false, reason: "already-registered" };

  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
  const verification = mintVerification();
  const now = new Date();

  // Consent is only ever recorded where it was actually given, with the
  // timestamp that proves when (section 25). Having an account is not opting
  // in, so the flag arrives from a checkbox or it does not arrive at all.
  const marketingConsent = input.marketingConsent === true;

  const data = {
    passwordHash,
    passwordChangedAt: now,
    emailVerificationToken: verification.token,
    emailVerificationExpiresAt: verification.expiresAt,
    verifyEmailStatus: "PENDING" as const,
    verifyEmailAttempts: 0,
    verifyEmailLastError: null,
    marketingConsent,
    marketingConsentAt: marketingConsent ? now : null,
  };

  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: {
          ...data,
          // A guest checkout may have left no name. Never overwrite one that
          // is there with one that is not.
          name: input.name?.trim() || undefined,
        },
      })
    : await prisma.customer.create({
        data: { ...data, email, name: input.name?.trim() || null },
      });

  return {
    ok: true,
    customerId: customer.id,
    email: customer.email,
    verification,
  };
}

/**
 * Check an email and password.
 *
 * Returns null for every failure without saying which, because "no such
 * account" and "wrong password" are the same answer to anybody who should not
 * have it. A guest row with no password falls in here too and is simply not an
 * account.
 */
export async function authenticateCustomer(input: {
  email: string;
  password: string;
}): Promise<{ id: string; email: string } | null> {
  const email = input.email.trim().toLowerCase();
  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!customer?.passwordHash) return null;
  if (!(await compare(input.password, customer.passwordHash))) return null;

  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  });

  return { id: customer.id, email: customer.email };
}

/**
 * Issue a fresh verification link and put it back in the queue.
 *
 * Always a NEW token: re-sending the old one would mean a link from an email
 * somebody forwarded months ago still works. Returns null when there is
 * nothing to verify, which includes an address that is already proven.
 */
export async function reissueVerification(
  customerId: string,
): Promise<NewVerification | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, passwordHash: true, emailVerifiedAt: true },
  });
  if (!customer?.passwordHash) return null;
  if (customer.emailVerifiedAt) return null;

  const verification = mintVerification();
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      emailVerificationToken: verification.token,
      emailVerificationExpiresAt: verification.expiresAt,
      verifyEmailStatus: "PENDING",
      verifyEmailAttempts: 0,
      verifyEmailLastError: null,
    },
  });
  return verification;
}

export type VerifyResult =
  | { ok: true; customerId: string; email: string }
  | { ok: false; reason: "unknown" | "expired" };

/**
 * Spend a verification link.
 *
 * The token is cleared in the same write that sets `emailVerifiedAt`, so a
 * link works exactly once. An expired one is told apart from an unknown one
 * because the two need different words in front of the person: "ask for
 * another" versus "this is not a link we issued".
 */
export async function consumeVerificationToken(
  token: string,
): Promise<VerifyResult> {
  const customer = await prisma.customer.findUnique({
    where: { emailVerificationToken: token },
    select: { id: true, email: true, emailVerificationExpiresAt: true },
  });
  if (!customer) return { ok: false, reason: "unknown" };

  if (
    customer.emailVerificationExpiresAt &&
    customer.emailVerificationExpiresAt.getTime() < Date.now()
  ) {
    return { ok: false, reason: "expired" };
  }

  const now = new Date();

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      emailVerifiedAt: now,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
      // ⚠️ Every session issued BEFORE this moment dies here, and that is the
      // point — it closes an account pre-hijack a security review found.
      //
      // The attack: somebody registers with a victim's address before the
      // victim does. The row is adopted, the attacker holds a password on it,
      // and a verification email goes to the VICTIM's inbox saying an account
      // is waiting to be confirmed. A victim who has genuinely shopped here
      // plausibly clicks it — and the click proves the address on the row the
      // attacker has the password to. Because the session is re-read from the
      // row on every request, the attacker's still-live cookie would gain the
      // victim's whole order history at that instant. The victim's own action
      // completes the attack.
      //
      // `passwordChangedAt` is the mechanism that already exists for "kill
      // what came before", so it is reused rather than duplicated. The honest
      // consequence is that clicking the link signs you out, which is why the
      // page that spends the token says to sign in afterwards. Verifying is a
      // once-per-account event; the trade is easy.
      passwordChangedAt: now,
      // `verifyEmailStatus` is deliberately left alone. Clearing the token is
      // what takes this row out of the sweep's queue — the drain asks for a
      // token and an unproven address, not for a status — so there is nothing
      // here to correct, and writing SENT over a mail that may never have left
      // (the queue can be blocked for want of a provider) would be a lie in a
      // column whose whole job is to say what happened.
    },
  });

  return { ok: true, customerId: customer.id, email: customer.email };
}

/** One line of an order, as the account page shows it. */
export interface AccountOrderLine {
  productName: string | null;
  variantName: string | null;
  caseColor: string | null;
  quantity: number;
  unitPriceCents: number;
}

export interface AccountOrder {
  orderNumber: string;
  placedAt: Date;
  status: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date | null;
  items: AccountOrderLine[];
}

/**
 * The customer's own orders — or null, which means "not proven, not shown".
 *
 * ⚠️ The verification check is INSIDE this function on purpose. Putting it in
 * the page and the API route instead would be two copies of the one rule that
 * makes this feature safe, and the admin side already has the scar from
 * exactly that: `/api/orders` and `/api/customers` shipped with no check at
 * all because the check was something each route was supposed to remember.
 *
 * The `select` is explicit for the same reason `/api/analytics/sales` is: a
 * bare `findMany` hands back the whole Order row, and this one is read by a
 * page on the public internet.
 */
export async function listCustomerOrders(
  customerId: string,
): Promise<AccountOrder[] | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { emailVerifiedAt: true },
  });
  if (!customer?.emailVerifiedAt) return null;

  const orders = await prisma.order.findMany({
    where: {
      customerId,
      // An order that was never paid for is a checkout somebody abandoned. It
      // is not history, and showing it would invite "why does it say pending".
      status: { notIn: ["PENDING", "CANCELLED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      orderNumber: true,
      createdAt: true,
      status: true,
      currency: true,
      subtotalCents: true,
      shippingCents: true,
      discountCents: true,
      totalCents: true,
      trackingNumber: true,
      carrier: true,
      shippedAt: true,
      items: {
        select: {
          productName: true,
          variantName: true,
          caseColor: true,
          quantity: true,
          unitPriceCents: true,
        },
      },
    },
  });

  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    placedAt: order.createdAt,
    status: order.status,
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    trackingNumber: order.trackingNumber,
    carrier: order.carrier,
    shippedAt: order.shippedAt,
    items: order.items,
  }));
}

/**
 * The two things a customer may change about themselves.
 *
 * Not the email: it is the key the Stripe webhook matches orders on, and
 * moving it would silently hand this account somebody else's history or lose
 * its own. Changing it properly means proving the new address before the old
 * one stops working, which is a flow of its own.
 */
export async function updateCustomerProfile(
  customerId: string,
  input: { name?: string | null; phone?: string | null; marketingConsent?: boolean },
): Promise<void> {
  const current = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { marketingConsent: true, emailVerifiedAt: true },
  });
  if (!current) return;

  // ⚠️ The other half of the same gate. Reading a guest buyer's name and phone
  // is closed in `getCustomerFromCookies`; this stops an unproved registrant
  // OVERWRITING them on a row that is not theirs. Consent is still theirs to
  // set — it is about what we may send to the address, and withholding that
  // would mean an unverified person could not decline marketing.
  const mayEditIdentity = current.emailVerifiedAt !== null;

  const consentChanged =
    input.marketingConsent !== undefined &&
    input.marketingConsent !== current.marketingConsent;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      name:
        !mayEditIdentity || input.name === undefined
          ? undefined
          : input.name?.trim() || null,
      phone:
        !mayEditIdentity || input.phone === undefined
          ? undefined
          : input.phone?.trim() || null,
      ...(input.marketingConsent === undefined
        ? {}
        : { marketingConsent: input.marketingConsent }),
      // The timestamp is the proof of WHEN consent was given, so it moves only
      // when the answer actually changes — and it is cleared on withdrawal
      // rather than left behind describing a consent that no longer exists.
      ...(consentChanged
        ? { marketingConsentAt: input.marketingConsent ? new Date() : null }
        : {}),
    },
  });
}

/**
 * Mint a reset link, or decide there is nothing to reset.
 *
 * ⚠️ Returns null when the address has no account — and **the route above this
 * must answer identically either way**. That is not belt-and-braces, it is the
 * whole security of an unauthenticated endpoint that takes an email address:
 * anything that differs between "has an account" and "does not" turns this into
 * an oracle anybody can walk a list of addresses through, at whatever speed the
 * limiter allows.
 *
 * ⚠️ Yes, `registerCustomer` already leaks that same bit through its
 * `already-registered` reply, and that trade is documented up there. It is not
 * a licence to leak it again. Two oracles are worse than one: they have
 * different limiter keys, so a script blocked on one simply uses the other, and
 * closing register's one day would fix nothing while this one stands.
 *
 * A guest row falls in here too, and correctly. A row with no password has
 * never been an account, so there is nothing to reset — the way back in for
 * that person is to register, which adopts the row.
 *
 * Always a NEW token, for the reason `reissueVerification` gives: re-sending an
 * old one means a link from a forwarded email still opens the account.
 */
export async function requestPasswordReset(
  rawEmail: string,
): Promise<NewPasswordReset | null> {
  const email = rawEmail.trim().toLowerCase();
  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  if (!customer?.passwordHash) return null;

  const reset = mintPasswordReset();
  await prisma.customer.update({
    where: { id: customer.id },
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

export type PasswordResetResult =
  | { ok: true; customerId: string; email: string }
  | { ok: false; reason: "unknown" | "expired" };

/**
 * Spend a reset link and set the new password.
 *
 * Three things happen in the one write, and each is load-bearing:
 *
 *  1. **The token is cleared**, so the link works exactly once. A link that
 *     still works after use is a credential sitting in an inbox for ever.
 *
 *  2. **`passwordChangedAt` moves**, which kills every session that existed
 *     before this moment — including the attacker's, in the case this flow is
 *     most needed for. Somebody who registered with a victim's address and
 *     holds a password on that row loses it the instant the real owner of the
 *     mailbox resets: they had the password, the victim had the mailbox, and
 *     the mailbox wins. That is the correct outcome and it is why a reset is a
 *     security feature and not only a convenience.
 *
 *  3. **The address becomes verified** if it was not already. This is not a
 *     shortcut: receiving mail at an address and using what it contained is the
 *     same proof the verification link asks for, delivered by a stronger act.
 *     Withholding order history from somebody who has just demonstrated control
 *     of the mailbox would be theatre. Any pending verification token is
 *     cleared in the same write, so an older link cannot later re-stamp the row
 *     and sign the person out again for no reason.
 *
 * `resetEmailStatus` is deliberately left alone, exactly as
 * `consumeVerificationToken` leaves `verifyEmailStatus`: that column records
 * what happened to a message, not what state the account reached.
 */
export async function consumePasswordReset(
  token: string,
  newPassword: string,
): Promise<PasswordResetResult> {
  const customer = await prisma.customer.findUnique({
    where: { passwordResetToken: token },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      passwordResetExpiresAt: true,
    },
  });
  if (!customer) return { ok: false, reason: "unknown" };

  // A row that lost its password between the request and the click is not an
  // account any more, and this token should not be able to recreate one.
  if (!customer.passwordHash) return { ok: false, reason: "unknown" };

  if (
    customer.passwordResetExpiresAt &&
    customer.passwordResetExpiresAt.getTime() < Date.now()
  ) {
    return { ok: false, reason: "expired" };
  }

  const now = new Date();

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      passwordHash: await hash(newPassword, BCRYPT_ROUNDS),
      passwordChangedAt: now,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      ...(customer.emailVerifiedAt
        ? {}
        : {
            emailVerifiedAt: now,
            emailVerificationToken: null,
            emailVerificationExpiresAt: null,
          }),
    },
  });

  return { ok: true, customerId: customer.id, email: customer.email };
}

/** Changing a password kills every token issued before it. */
export async function changeCustomerPassword(
  customerId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { passwordHash: true },
  });
  if (!customer?.passwordHash) return false;
  if (!(await compare(currentPassword, customer.passwordHash))) return false;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      passwordHash: await hash(newPassword, BCRYPT_ROUNDS),
      passwordChangedAt: new Date(),
    },
  });
  return true;
}
