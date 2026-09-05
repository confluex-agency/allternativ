import { describe, it, expect } from "vitest";
import {
  buildOrderConfirmation,
  outcomeForFailure,
  NoEmailProviderError,
  PermanentEmailError,
  EMAIL_MAX_ATTEMPTS,
  type ConfirmationOrder,
} from "@/lib/email";

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
