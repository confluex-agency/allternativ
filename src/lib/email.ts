// The confirmation email: what it says, and how it leaves.
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

// ── How it leaves ───────────────────────────────────────────────────────────

/**
 * The transport, and deliberately the only place that knows about a provider.
 *
 * ⚠️ No provider is wired yet — the choice is the client's and needs an account
 * and a verified sending domain. Until then this throws `NoEmailProviderError`
 * and orders stay queued rather than failing, so nothing is lost and the mails
 * go out the day a key is set.
 *
 * Resend is sketched below because it is the smallest thing that works from a
 * Next.js app on shared hosting: one HTTP call, no SDK required.
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
