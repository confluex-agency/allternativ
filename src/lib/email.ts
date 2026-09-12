// The four emails this shop sends: what they say, and how they leave.
//
// Two are about an order (confirmation, dispatch) and two are about an account
// (verify an address, reset a password). All four are queued on a row and
// drained by the sweep, for the reason below. ⚠️ This header said "the two
// emails" until 2026-09-12, having been written when there were two and never
// corrected as the third and fourth arrived — the same way a comment always
// goes stale. If a fifth is added, this line is part of the work.
//
// ── Why it is queued and not sent from the webhook ──────────────────────────
// The webhook is the only place an order is created, and it answers Stripe
// synchronously: if it fails, Stripe retries for three days, which is exactly
// the durability the payment path wants. That property is also a trap. Anything
// slow put inside that handler can turn a 400ms response into a timeout, and
// Stripe would then retry a payment that already succeeded — leaving the event
// marked failed for three days over a mail server having a bad afternoon.
//
// So the order is written synchronously and the mail is queued on it
// (`emailStatus = PENDING`), then drained by `scripts/sweep-orders.ts`. The
// database is the queue. No broker, for the same reason there is no broker on
// the payment path: one table and one script answer the whole requirement.
//
// ⚠️ The shop PROMISES this mail. `/checkout/success` tells the buyer "we'll
// send you a confirmation email", so an order sitting at PENDING for ever is a
// broken promise, not a missing nicety. `sweep-orders.ts` shouts about the
// backlog for that reason.

import { formatCurrency } from "@/lib/utils";
import { DELIVERY_ESTIMATE_BUSINESS_DAYS } from "@/lib/shipping";

/** Give up after this many tries and stop retrying for ever. */
export const EMAIL_MAX_ATTEMPTS = 5;

/** No provider is configured yet. Not the order's fault, so it stays queued. */
export class NoEmailProviderError extends Error {
  constructor() {
    super(
      "No email provider configured. Set RESEND_API_KEY and EMAIL_FROM " +
        "(or wire another provider in sendEmail). Orders stay queued.",
    );
    this.name = "NoEmailProviderError";
  }
}

/** A refusal that retrying cannot fix, such as an address that is not one. */
export class PermanentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentEmailError";
  }
}

// ── What the sweep should do with an order after an attempt ─────────────────
//
// Pulled out as a pure function so the decision can be tested without a mail
// provider, a database or a network. The three outcomes are deliberately
// different, and collapsing any two of them loses something:
//
//   * `keep`     — nothing is wrong with this order, try again later.
//   * `retry`    — this attempt failed, but another might not.
//   * `giveUp`   — no further attempt will help, or there have been enough.

// Split from `EmailOutcome` on purpose. A failure can never be `sent`, and
// saying so in the type is what lets the caller read `.attempts` without
// narrowing past a case that cannot happen. The wider union kept the caller
// honest about a branch that did not exist.
export type EmailFailureOutcome =
  | { kind: "keep"; reason: string }
  | { kind: "retry"; attempts: number; error: string }
  | { kind: "giveUp"; attempts: number; error: string };

export type EmailOutcome = { kind: "sent" } | EmailFailureOutcome;

export function outcomeForFailure(
  attemptsBefore: number,
  error: unknown,
): EmailFailureOutcome {
  const message = error instanceof Error ? error.message : String(error);

  // A missing provider is a deployment gap, not a bad order. Burning the
  // attempt counter on it would quietly mark every order FAILED before anybody
  // had chosen a provider, and those orders would then never be mailed even
  // once one existed.
  if (error instanceof NoEmailProviderError) {
    return { kind: "keep", reason: message };
  }

  const attempts = attemptsBefore + 1;

  if (error instanceof PermanentEmailError) {
    return { kind: "giveUp", attempts, error: message };
  }
  if (attempts >= EMAIL_MAX_ATTEMPTS) {
    return { kind: "giveUp", attempts, error: message };
  }
  return { kind: "retry", attempts, error: message };
}

// ── What the mail says ──────────────────────────────────────────────────────

export interface ConfirmationOrder {
  orderNumber: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  shippingName: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingZip: string | null;
  shippingCountry: string | null;
  items: {
    productName: string | null;
    variantName: string | null;
    caseColor: string | null;
    quantity: number;
    unitPriceCents: number;
  }[];
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Built from the ORDER, never from the catalogue.
 *
 * The order froze the product name, the colourway and the case colour at sale
 * time precisely so that what the buyer is told matches what they bought, even
 * if the catalogue is edited in between. Reading the live product here would
 * throw that away and could mail somebody a description of a different pair.
 */
export function buildOrderConfirmation(
  to: string,
  order: ConfirmationOrder,
): EmailMessage {
  // ⚠️ `formatCurrency`, never `formatPrice`. The latter rounds to whole units
  // on purpose -- it is for the shop front, where "EUR 39" reads better than
  // "EUR 39.00" -- and it would turn EUR 15.10 of delivery into EUR 15 in a
  // document the buyer will hold against their card statement.
  const money = (cents: number) => formatCurrency(cents, order.currency);

  const lines = order.items.map((i) => {
    const name = [i.productName, i.variantName].filter(Boolean).join(" — ");
    // The case is an option of the purchase rather than a variant, so it does
    // not appear in the name and has to be said explicitly.
    const to_case = i.caseColor ? ` (case: ${i.caseColor.toLowerCase()})` : "";
    return `  ${i.quantity} x ${name}${to_case}  ${money(i.unitPriceCents * i.quantity)}`;
  });

  const address = [
    order.shippingName,
    order.shippingAddress,
    [order.shippingZip, order.shippingCity].filter(Boolean).join(" "),
    order.shippingCountry,
  ]
    .filter((part) => part && part.trim() !== "")
    .map((part) => `  ${part}`);

  const totals = [`  Subtotal        ${money(order.subtotalCents)}`];
  if (order.discountCents > 0) {
    totals.push(`  Discount       -${money(order.discountCents)}`);
  }
  // Said explicitly when it is nothing, because free delivery from two pairs up
  // is the shop's own offer and worth the buyer seeing it applied.
  totals.push(
    order.shippingCents === 0
      ? "  Shipping        Free"
      : `  Shipping        ${money(order.shippingCents)}`,
  );
  totals.push(`  Total           ${money(order.totalCents)}`);

  const text = [
    `Thank you for your order.`,
    ``,
    `Order ${order.orderNumber}`,
    ``,
    ...lines,
    ``,
    ...totals,
    ``,
    `Shipping to:`,
    ...address,
    ``,
    `We'll email you again with tracking as soon as it ships.`,
    ``,
    `Allternativ`,
  ].join("\n");

  return { to, subject: `Your Allternativ order ${order.orderNumber}`, text };
}

/**
 * What the dispatch notification needs. A subset of the order, and no money:
 * the buyer already has the figures in their confirmation, and repeating them
 * in a "your order shipped" note invites a second reading of a total that was
 * settled days ago.
 */
export interface DispatchOrder {
  orderNumber: string;
  trackingNumber: string | null;
  carrier: string | null;
  shippingName: string | null;
  shippingCountry: string | null;
  items: {
    productName: string | null;
    variantName: string | null;
    caseColor: string | null;
    quantity: number;
  }[];
}

/**
 * "Your order has shipped", with the tracking number.
 *
 * ⚠️ This mail exists because two separate things promised it. The client asked
 * for it in writing on 2026-08-20 — *"el cliente recibirá un Tracking ID"* —
 * and the confirmation email has been telling buyers "we'll email you again
 * with tracking as soon as it ships" since the day it was written. For a while
 * nothing sent it, which made the confirmation a document that lied.
 *
 * Built from the ORDER like the confirmation, and for the same reason.
 */
export function buildDispatchNotification(
  to: string,
  order: DispatchOrder,
): EmailMessage {
  const lines = order.items.map((i) => {
    const name = [i.productName, i.variantName].filter(Boolean).join(" — ");
    const withCase = i.caseColor ? ` (case: ${i.caseColor.toLowerCase()})` : "";
    return `  ${i.quantity} x ${name}${withCase}`;
  });

  // ⚠️ No tracking number, no email. The caller already refuses to queue one,
  // and this is the second guard: a "here is your tracking" message with a
  // blank where the number goes is worse than silence, because the buyer then
  // writes in to ask for what the mail was supposed to contain.
  const tracking = order.trackingNumber
    ? [
        order.carrier
          ? `  ${order.carrier}  ${order.trackingNumber}`
          : `  ${order.trackingNumber}`,
      ]
    : [];

  const text = [
    `Your order is on its way.`,
    ``,
    `Order ${order.orderNumber}`,
    ``,
    ...lines,
    ``,
    ...(tracking.length > 0 ? [`Tracking:`, ...tracking, ``] : []),
    `Delivery usually takes ${DELIVERY_ESTIMATE_BUSINESS_DAYS.minimum}-${DELIVERY_ESTIMATE_BUSINESS_DAYS.maximum} business days from dispatch.`,
    `Tracking can take a day or two to start showing movement.`,
    ``,
    `Allternativ`,
  ].join("\n");

  return {
    to,
    subject: `Your Allternativ order ${order.orderNumber} has shipped`,
    text,
  };
}

/**
 * The third queued email: proving an address belongs to whoever typed it.
 *
 * ⚠️ This one is not a courtesy, it is a lock. A `Customer` row is created by
 * the Stripe webhook for every guest buyer, so registering an account very
 * often means putting a password on a row that already holds somebody's order
 * history and shipping address. Clicking this link is the only thing that opens
 * that history. See `src/lib/customer-accounts.ts`.
 *
 * The link is built from `NEXT_PUBLIC_APP_URL`, which is the same variable
 * `success_url` is built from and carries the same warning: it is inlined at
 * build time, and a wrong value here mails people a link to localhost.
 */
export function buildEmailVerification(
  to: string,
  opts: { name: string | null; token: string; expiresAt: Date },
): EmailMessage {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const url = `${base.replace(/\/+$/, "")}/account/verify?token=${encodeURIComponent(opts.token)}`;
  const hours = Math.max(
    1,
    Math.round((opts.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000)),
  );

  // ⚠️ The wording is deliberate and it is a security control, not copy.
  //
  // It used to open "Confirm this address to finish setting up your account",
  // which reads as something the reader did. That is exactly what makes an
  // account pre-hijack work: somebody else registers with your address, you
  // get a plausible-looking confirmation mail, you click it, and you have just
  // proved the address on a row THEY hold the password to.
  //
  // So it says plainly that a request was made, not that the reader made it,
  // and it says what ignoring it costs: nothing. Verifying now also ends every
  // session on the account, which is the other half of the fix — but the
  // person who should not click still needs to be told not to.
  const text = [
    opts.name ? `Hello ${opts.name},` : `Hello,`,
    ``,
    `Somebody asked to create an Allternativ account for this email address.`,
    `If that was you, confirm it here:`,
    ``,
    `  ${url}`,
    ``,
    `The link works once and expires in about ${hours} hours.`,
    ``,
    `Confirming is what opens your order history. Until then an account can be`,
    `signed into but shows nothing about you — we do not show what somebody`,
    `bought, or where it was sent, to an address nobody has proved they own.`,
    ``,
    `If this was NOT you, do nothing at all. Ignoring this email leaves your`,
    `order history closed, and no order you have placed is affected either way.`,
    `Do not forward this link to anybody.`,
    ``,
    `Allternativ`,
  ].join("\n");

  return { to, subject: "Confirm your Allternativ account", text };
}

/**
 * The fourth queued email: getting back in without us.
 *
 * ⚠️ This is the only one of the four that is a CREDENTIAL. The confirmation
 * and dispatch mails describe something that already happened; the verification
 * link can at most mark an address proven. This one hands over the account to
 * whoever opens it, which is why its token lives a few hours instead of three
 * days — see `PASSWORD_RESET_TTL_MINUTES`.
 *
 * Two consequences for what it says, and both are security rather than copy:
 *
 *  * It states that **nothing has changed yet**. A reset mail that reads like a
 *    completed action makes a person who did not ask for it panic, and a
 *    panicked person clicks the link in the mail to "check" — which is exactly
 *    the thing that must not happen. The safe action for the wrong recipient is
 *    to do nothing, so the mail says so plainly and says it costs them nothing.
 *
 *  * It never says whether the address has an account. The request endpoint
 *    answers identically either way; putting "we found your account" in the one
 *    place the answer is visible would give the whole thing back, to anybody
 *    who can see the mailbox.
 *
 * Built from `NEXT_PUBLIC_APP_URL`, with the same warning as the rest: it is
 * inlined at build time, and a wrong value mails people a link to localhost.
 */
export function buildPasswordReset(
  to: string,
  opts: { name: string | null; token: string; expiresAt: Date },
): EmailMessage {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const url = `${base.replace(/\/+$/, "")}/account/reset?token=${encodeURIComponent(opts.token)}`;

  // ⚠️ Said in the unit a person thinks in. "Expires in about 180 minutes" is
  // arithmetic homework in a message somebody is reading on a phone while doing
  // something else — which, as the first end-to-end test found out, is exactly
  // when this mail gets read. Under two hours it stays in minutes, because
  // "about 1 hour" rounds away the difference between fifty minutes and ten.
  const minutes = Math.max(
    5,
    Math.round((opts.expiresAt.getTime() - Date.now()) / (60 * 1000)),
  );
  const lifetime =
    minutes >= 120
      ? `${Math.round(minutes / 60)} hours`
      : `${minutes} minutes`;

  const text = [
    opts.name ? `Hello ${opts.name},` : `Hello,`,
    ``,
    `Somebody asked to reset the password for an Allternativ account using this`,
    `email address. If that was you, choose a new one here:`,
    ``,
    `  ${url}`,
    ``,
    `The link works once and expires in about ${lifetime}.`,
    ``,
    `Nothing has changed yet. Your current password still works, and it keeps`,
    `working unless you open the link above and choose a different one.`,
    ``,
    `If this was NOT you, do nothing at all. Ignoring this email leaves the`,
    `account exactly as it is — whoever asked cannot do anything without the`,
    `link, and the link is only in this message. Do not forward it to anybody.`,
    ``,
    `Allternativ`,
  ].join("\n");

  return { to, subject: "Reset your Allternativ password", text };
}

// ── How it leaves ───────────────────────────────────────────────────────────

/**
 * The transport, and deliberately the only place that knows about a provider.
 *
 * Resend, because it is the smallest thing that works from a Next.js app on
 * shared hosting: one HTTP call, no SDK, and no need to find out whether
 * outbound SMTP is even open from the Hostinger Node container.
 *
 * As of 2026-09-11 `RESEND_API_KEY`, `EMAIL_FROM` and `EMAIL_REPLY_TO` are set
 * in the staging variables and the DNS for `send.allternativ.com` is in place.
 *
 * ⚠️ Configured is not the same as proved. Nothing has been observed leaving:
 * the sweep only reaches this function when the queue has something in it, so
 * an empty queue reports success either way. The `NoEmailProviderError` path
 * below is still the right behaviour if a key is ever removed — orders stay
 * queued rather than failing, and nothing is lost.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) throw new NoEmailProviderError();

  // ⚠️ `EMAIL_REPLY_TO` exists because of where `EMAIL_FROM` has to live.
  //
  // The sending domain is a SUBDOMAIN — `send.allternativ.com` — so that adding
  // a provider does not mean editing the SPF record the founders' own mailboxes
  // depend on. The provider then requires `from` to be on that subdomain — and
  // that subdomain does not receive mail.
  //
  // Resend's setup separates the two: the records that let it SEND are a DKIM
  // TXT and a pair of CNAMEs, and receiving is a switch of its own that we leave
  // off. So `send.allternativ.com` ends up with no MX and no address record,
  // and **a customer who hits reply gets a bounce.**
  //
  // ⚠️ Turning that switch on would not fix it. It would point the subdomain at
  // the provider's inbound handling, not at a person, which trades a bounce for
  // a message that is accepted and read by nobody — quieter, and worse.
  //
  // People do reply to order confirmations. It is often how a shop first hears
  // "wrong address" or "cancel this".
  //
  // So the reply goes back to the real mailbox on the root domain, which
  // Hostinger already hosts. Optional, and absent it simply is not sent — a
  // sending address on a domain that does receive human mail needs no override.
  const replyTo = process.env.EMAIL_REPLY_TO;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (res.ok) return;

  const body = await res.text().catch(() => "");
  // 4xx that is not rate limiting is the provider saying no, and it will say no
  // again tomorrow: a malformed address, an unverified domain, a revoked key.
  // Retrying those for days would hide the real problem behind a queue.
  if (res.status >= 400 && res.status < 500 && res.status !== 429) {
    throw new PermanentEmailError(`${res.status}: ${body.slice(0, 200)}`);
  }
  throw new Error(`${res.status}: ${body.slice(0, 200)}`);
}
