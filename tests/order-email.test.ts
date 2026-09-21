import { describe, it, expect } from "vitest";
import {
  buildOrderConfirmation,
  buildDispatchNotification,
  outcomeForFailure,
  NoEmailProviderError,
  PermanentEmailError,
  EMAIL_MAX_ATTEMPTS,
  type ConfirmationOrder,
  type DispatchOrder,
  buildPasswordReset,
} from "@/lib/email";
import { COMPANY } from "@/lib/legal";

// The confirmation email is queued on the order and drained by
// scripts/sweep-orders.ts, so the two things worth testing without a provider
// are the decision the sweep makes after a failure, and what the buyer reads.
//
// The decision matters more than it looks. Collapsing "no provider configured"
// into "this order failed" would march every queued order to FAILED before
// anybody had chosen a provider, and those buyers would then never be mailed
// even once one existed.

const order: ConfirmationOrder = {
  orderNumber: "ALT-20260905-2814",
  currency: "EUR",
  subtotalCents: 19500,
  shippingCents: 1510,
  discountCents: 0,
  totalCents: 21010,
  shippingName: "Prueba E2E",
  shippingAddress: "Calle de Prueba 1",
  shippingCity: "Madrid",
  shippingZip: "28001",
  shippingCountry: "ES",
  items: [
    {
      productName: "The Corinthian",
      variantName: "Olive Green",
      caseColor: "BLACK",
      quantity: 1,
      unitPriceCents: 3900,
    },
    {
      productName: "Orbital",
      variantName: "Sand Black",
      caseColor: "WHITE",
      quantity: 2,
      unitPriceCents: 3900,
    },
  ],
};

describe("what the sweep does after a failed send", () => {
  it("leaves the order alone when no provider is configured", () => {
    // Not the order's fault. It must not burn an attempt, and it must not be
    // marked failed: the day a key is set, these still have to go out.
    const outcome = outcomeForFailure(0, new NoEmailProviderError());
    expect(outcome.kind).toBe("keep");
  });

  it("keeps the order queued however many times the provider is missing", () => {
    const outcome = outcomeForFailure(EMAIL_MAX_ATTEMPTS + 10, new NoEmailProviderError());
    expect(outcome.kind).toBe("keep");
  });

  it("retries a transient failure and counts the attempt", () => {
    const outcome = outcomeForFailure(1, new Error("503: upstream busy"));
    expect(outcome).toMatchObject({ kind: "retry", attempts: 2 });
  });

  it("gives up at once on a refusal that will not change", () => {
    // An unverified domain or a malformed address says no again tomorrow.
    // Retrying for days would bury the real problem inside a queue.
    const outcome = outcomeForFailure(0, new PermanentEmailError("422: bad address"));
    expect(outcome).toMatchObject({ kind: "giveUp", attempts: 1 });
  });

  it("gives up once the attempts run out", () => {
    const outcome = outcomeForFailure(EMAIL_MAX_ATTEMPTS - 1, new Error("timeout"));
    expect(outcome).toMatchObject({ kind: "giveUp", attempts: EMAIL_MAX_ATTEMPTS });
  });

  it("keeps retrying right up to the last attempt", () => {
    const outcome = outcomeForFailure(EMAIL_MAX_ATTEMPTS - 2, new Error("timeout"));
    expect(outcome.kind).toBe("retry");
  });
});

describe("what the buyer reads", () => {
  it("names the order and every line that was bought", () => {
    const mail = buildOrderConfirmation("buyer@example.com", order);
    expect(mail.to).toBe("buyer@example.com");
    expect(mail.subject).toContain("ALT-20260905-2814");
    expect(mail.text).toContain("The Corinthian — Olive Green");
    expect(mail.text).toContain("Orbital — Sand Black");
    expect(mail.text).toContain("2 x Orbital");
  });

  it("says the case colour, which no product name carries", () => {
    // The case is an option of the purchase rather than a variant, so if the
    // mail does not say it, nothing the buyer can see does.
    const mail = buildOrderConfirmation("buyer@example.com", order);
    expect(mail.text).toContain("(case: black)");
    expect(mail.text).toContain("(case: white)");
  });

  it("prices the line by quantity, not per unit", () => {
    const mail = buildOrderConfirmation("buyer@example.com", order);
    // Two Orbitals at 39.00 is 78.00, and a buyer checking the arithmetic
    // against their card statement should find it.
    expect(mail.text).toContain("78.00");
  });

  it("shows free delivery as free rather than as nothing", () => {
    const free = buildOrderConfirmation("b@example.com", {
      ...order,
      shippingCents: 0,
      totalCents: 19500,
    });
    expect(free.text).toContain("Shipping        Free");
  });

  it("shows a discount only when there was one", () => {
    const plain = buildOrderConfirmation("b@example.com", order);
    expect(plain.text).not.toContain("Discount");

    const discounted = buildOrderConfirmation("b@example.com", {
      ...order,
      discountCents: 1000,
      totalCents: 20010,
    });
    expect(discounted.text).toContain("Discount");
  });

  it("speaks in the client's own words around the order", () => {
    // Point D3 of their answer of 2026-09-19, as written.
    const mail = buildOrderConfirmation("buyer@example.com", order);
    expect(mail.text.startsWith("THANK YOU FOR YOUR ORDER.")).toBe(true);
    expect(mail.text).toContain("You've just entered the ALLTERNATIV frequency.");
    expect(mail.text).toContain("ORDER ALT-20260905-2814");
    expect(mail.text).toContain("SHIPPING TO");
    expect(mail.text).toContain("including your tracking details");
    expect(mail.text.endsWith("ALLTERNATIV\nEscape the ordinary.")).toBe(true);
  });

  it("gives the same support address the site does", () => {
    // Their drafts named three different ones. Whichever they choose, the mail
    // must not disagree with the contact page, and never names a Gmail.
    const mail = buildOrderConfirmation("buyer@example.com", order);
    expect(mail.text).toContain(`Questions? Contact us at ${COMPANY.contactEmail}`);
    expect(mail.text).not.toContain("gmail.com");
  });

  it("carries the address the parcel is going to", () => {
    const mail = buildOrderConfirmation("buyer@example.com", order);
    expect(mail.text).toContain("Calle de Prueba 1");
    expect(mail.text).toContain("28001 Madrid");
  });

  it("does not print empty lines for an address it does not have", () => {
    const sparse = buildOrderConfirmation("b@example.com", {
      ...order,
      shippingAddress: null,
      shippingCity: null,
      shippingZip: null,
    });
    expect(sparse.text).not.toMatch(/\n {2}\n/);
  });
});

// ── The dispatch notification ───────────────────────────────────────────────
//
// It exists because two separate things promised it: the client asked for a
// Tracking ID in writing on 2026-08-20, and the confirmation email tells every
// buyer "we'll email you again with tracking as soon as it ships". For a while
// nothing sent it, which made the confirmation a document that lied.

const shipped: DispatchOrder = {
  orderNumber: "ALT-20260905-2814",
  trackingNumber: "YT2609052814001",
  carrier: "YunExpress",
  shippingName: "Prueba E2E",
  shippingCountry: "MT",
  items: [
    {
      productName: "The Corinthian",
      variantName: "Olive Green",
      caseColor: "BLACK",
      quantity: 1,
    },
    {
      productName: "Orbital",
      variantName: "Sand Black",
      caseColor: "WHITE",
      quantity: 2,
    },
  ],
};

describe("what the buyer reads when it ships", () => {
  it("carries the tracking number and the carrier", () => {
    const { text } = buildDispatchNotification("a@b.com", shipped);
    expect(text).toContain("YT2609052814001");
    expect(text).toContain("YunExpress");
  });

  it("names the order, so it can be told from another one", () => {
    const { subject, text } = buildDispatchNotification("a@b.com", shipped);
    expect(subject).toContain("ALT-20260905-2814");
    expect(text).toContain("ALT-20260905-2814");
  });

  it("says the case colour, exactly as the confirmation did", () => {
    // The buyer compares the two emails. A pair described one way when they
    // bought it and another way when it shipped reads as the wrong parcel.
    const { text } = buildDispatchNotification("a@b.com", shipped);
    expect(text).toContain("case: black");
    expect(text).toContain("case: white");
  });

  it("keeps the quantity, so two pairs do not look like one", () => {
    const { text } = buildDispatchNotification("a@b.com", shipped);
    expect(text).toContain("2 x Orbital");
  });

  it("prints no tracking section at all when there is no number", () => {
    // ⚠️ The sweep already refuses to queue one of these, and this is the
    // second guard. A "here is your tracking" with a blank where the number
    // goes is worse than silence: the buyer writes in to ask for the thing the
    // email was supposed to contain.
    const { text } = buildDispatchNotification("a@b.com", {
      ...shipped,
      trackingNumber: null,
      carrier: null,
    });
    expect(text).not.toContain("Tracking:");
  });

  it("quotes no money", () => {
    // The figures were settled in the confirmation. Repeating a total days
    // later invites a second reading of a decision already made.
    const { text } = buildDispatchNotification("a@b.com", shipped);
    expect(text).not.toMatch(/[€$£]/);
  });
});

describe("what somebody reads when they have forgotten their password", () => {
  const reset = (minutesFromNow: number) =>
    buildPasswordReset("buyer@example.com", {
      name: "Buyer",
      token: "a-token",
      expiresAt: new Date(Date.now() + minutesFromNow * 60 * 1000),
    });

  it("says how long it lasts in the unit a person thinks in", () => {
    // ⚠️ The lifetime moved from 60 minutes to 180 on 2026-09-12, and the naive
    // version of this sentence then read "expires in about 180 minutes" —
    // arithmetic homework in a message somebody reads on a phone, mid-something
    // else, which is precisely when this mail gets read.
    expect(reset(180).text).toContain("about 3 hours");
    expect(reset(180).text).not.toMatch(/\d{3,} minutes/);

    // Under two hours it stays in minutes: "about 1 hour" would round away the
    // difference between fifty minutes left and ten.
    expect(reset(50).text).toContain("about 50 minutes");
  });

  it("says a request was made, not that the reader made it", () => {
    // ⚠️ Security, not copy. A mail that reads like a completed action makes a
    // person who did not ask for it panic, and a panicked person clicks the
    // link to "check" — which is the one thing that must not happen. The safe
    // action for the wrong recipient is to do nothing, so the mail has to say
    // that nothing has happened and that ignoring it costs them nothing.
    const text = reset(180).text;
    expect(text).toContain("Somebody asked");
    expect(text).toContain("Nothing has changed yet");
    expect(text).toMatch(/If this was NOT you, do nothing/);
  });

  it("never says whether the address has an account", () => {
    // The request endpoint answers identically either way. Saying "we found
    // your account" in the one place the answer is visible would hand the whole
    // thing back to anybody who can see the mailbox.
    const text = reset(180).text.toLowerCase();
    for (const giveaway of ["we found", "your account exists", "no account"]) {
      expect(text).not.toContain(giveaway);
    }
  });
});
