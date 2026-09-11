import { describe, expect, it, afterAll } from "vitest";
import { prisma, RUN, cleanUp, must } from "./helpers";
import {
  registerCustomer,
  authenticateCustomer,
  consumeVerificationToken,
  reissueVerification,
  listCustomerOrders,
  changeCustomerPassword,
  updateCustomerProfile,
} from "@/lib/customer-accounts";
import {
  signCustomerToken,
  verifyCustomerToken,
  passwordIsTooCloseToEmail,
} from "@/lib/customer-auth";
import { signToken, verifyToken } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

// Emails carry RUN so `cleanUp()` finds them; see tests/helpers.ts.
const email = (label: string) => `${label}.${RUN}@example.com`;
const PASSWORD = "a-long-enough-one";

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

describe("registration", () => {
  it("creates an account and queues a verification email", async () => {
    const address = email("new-account");
    const result = await registerCustomer({
      email: address,
      password: PASSWORD,
      name: "New Account",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verification.token.length).toBeGreaterThan(20);

    const row = must(
      await prisma.customer.findUnique({ where: { email: address } }),
      "the new customer",
    );
    expect(row.passwordHash).not.toBeNull();
    expect(row.emailVerifiedAt).toBeNull();
    // PENDING is the only way into the sweep's queue, and registration is the
    // only thing that writes it.
    expect(row.verifyEmailStatus).toBe("PENDING");
    expect(row.emailVerificationToken).toBe(result.verification.token);
  });

  it("refuses a second account for the same address", async () => {
    const address = email("twice");
    expect((await registerCustomer({ email: address, password: PASSWORD })).ok).toBe(
      true,
    );
    const second = await registerCustomer({ email: address, password: PASSWORD });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("already-registered");
  });

  it("puts a password on the row a guest checkout already left", async () => {
    // This is the shape the shop is actually in: the Stripe webhook created a
    // customer for a guest buyer long before anybody signed up.
    const address = email("was-a-guest");
    const guest = await prisma.customer.create({
      data: { email: address, name: "Guest Buyer", orderCount: 1, totalSpentCents: 3900 },
    });

    const result = await registerCustomer({ email: address, password: PASSWORD });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The SAME row, so the orders already filed against it stay filed.
    expect(result.customerId).toBe(guest.id);
    const row = must(
      await prisma.customer.findUnique({ where: { id: guest.id } }),
      "the guest row",
    );
    expect(row.orderCount).toBe(1);
    expect(row.name).toBe("Guest Buyer");
    expect(row.passwordHash).not.toBeNull();
  });

  it("does not opt anybody into marketing by signing up", async () => {
    const address = email("no-consent");
    await registerCustomer({ email: address, password: PASSWORD });
    const row = must(
      await prisma.customer.findUnique({ where: { email: address } }),
      "the customer",
    );
    expect(row.marketingConsent).toBe(false);
    expect(row.marketingConsentAt).toBeNull();
  });
});

describe("signing in", () => {
  it("accepts the right password and refuses everything else", async () => {
    const address = email("signin");
    await registerCustomer({ email: address, password: PASSWORD });

    expect(await authenticateCustomer({ email: address, password: PASSWORD })).not.toBeNull();
    expect(await authenticateCustomer({ email: address, password: "wrong-one-entirely" })).toBeNull();
    expect(await authenticateCustomer({ email: email("nobody"), password: PASSWORD })).toBeNull();
  });

  it("treats a guest row as not an account", async () => {
    // ⚠️ The important one. A guest row has an email and no password, and it
    // must never be a way in.
    const address = email("guest-no-password");
    await prisma.customer.create({ data: { email: address } });
    expect(await authenticateCustomer({ email: address, password: "" })).toBeNull();
    expect(await authenticateCustomer({ email: address, password: PASSWORD })).toBeNull();
  });

  it("kills tokens issued before a password change", async () => {
    const address = email("rotate");
    const registered = await registerCustomer({ email: address, password: PASSWORD });
    if (!registered.ok) throw new Error("registration failed");

    const before = must(
      await prisma.customer.findUnique({ where: { id: registered.customerId } }),
      "the customer",
    );

    const changed = await changeCustomerPassword(
      registered.customerId,
      PASSWORD,
      "a-different-long-one",
    );
    expect(changed).toBe(true);

    const after = must(
      await prisma.customer.findUnique({ where: { id: registered.customerId } }),
      "the customer",
    );
    expect(after.passwordChangedAt!.getTime()).toBeGreaterThanOrEqual(
      before.passwordChangedAt!.getTime(),
    );
    expect(await authenticateCustomer({ email: address, password: PASSWORD })).toBeNull();
    expect(
      await authenticateCustomer({ email: address, password: "a-different-long-one" }),
    ).not.toBeNull();
  });
});

describe("order history is gated on a proved address", () => {
  it("shows nothing at all until the address is verified, then shows the orders", async () => {
    const address = email("history");
    const registered = await registerCustomer({ email: address, password: PASSWORD });
    if (!registered.ok) throw new Error("registration failed");

    const paid = await prisma.order.create({
      data: {
        orderNumber: `ORD-${RUN}-PAID`,
        customerId: registered.customerId,
        status: "PAID",
        subtotalCents: 3900,
        totalCents: 3900,
        currency: "EUR",
      },
    });
    // An abandoned checkout is not history and must not be listed.
    await prisma.order.create({
      data: {
        orderNumber: `ORD-${RUN}-PENDING`,
        customerId: registered.customerId,
        status: "PENDING",
        subtotalCents: 3900,
        totalCents: 3900,
        currency: "EUR",
      },
    });

    // ⚠️ null, NOT an empty array. The page says different words for "you have
    // no orders" and "we are not showing you these yet", and flattening the two
    // would have somebody hunting for an order they definitely placed.
    expect(await listCustomerOrders(registered.customerId)).toBeNull();

    const consumed = await consumeVerificationToken(registered.verification.token);
    expect(consumed.ok).toBe(true);

    const orders = must(
      await listCustomerOrders(registered.customerId),
      "the order list",
    );
    expect(orders).toHaveLength(1);
    expect(orders[0].orderNumber).toBe(paid.orderNumber);
  });

  it("spends a verification link exactly once", async () => {
    const address = email("once");
    const registered = await registerCustomer({ email: address, password: PASSWORD });
    if (!registered.ok) throw new Error("registration failed");

    expect((await consumeVerificationToken(registered.verification.token)).ok).toBe(true);

    const again = await consumeVerificationToken(registered.verification.token);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("unknown");
  });

  it("tells an expired link apart from an unknown one", async () => {
    const address = email("expired");
    const registered = await registerCustomer({ email: address, password: PASSWORD });
    if (!registered.ok) throw new Error("registration failed");

    await prisma.customer.update({
      where: { id: registered.customerId },
      data: { emailVerificationExpiresAt: new Date(Date.now() - 1000) },
    });

    const result = await consumeVerificationToken(registered.verification.token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");

    const unknown = await consumeVerificationToken("not-a-token-we-ever-issued");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toBe("unknown");
  });

  it("issues a new token on resend, and none once verified", async () => {
    const address = email("resend");
    const registered = await registerCustomer({ email: address, password: PASSWORD });
    if (!registered.ok) throw new Error("registration failed");

    const reissued = must(
      await reissueVerification(registered.customerId),
      "the reissued token",
    );
    expect(reissued.token).not.toBe(registered.verification.token);

    // The old link is dead the moment a new one is issued, which is the point:
    // a link forwarded months ago must not still work.
    const old = await consumeVerificationToken(registered.verification.token);
    expect(old.ok).toBe(false);

    expect((await consumeVerificationToken(reissued.token)).ok).toBe(true);
    expect(await reissueVerification(registered.customerId)).toBeNull();
  });
});

describe("consent is recorded where it was given", () => {
  it("stamps the time it changed and clears it on withdrawal", async () => {
    const address = email("consent");
    const registered = await registerCustomer({
      email: address,
      password: PASSWORD,
      marketingConsent: true,
    });
    if (!registered.ok) throw new Error("registration failed");

    const given = must(
      await prisma.customer.findUnique({ where: { id: registered.customerId } }),
      "the customer",
    );
    expect(given.marketingConsent).toBe(true);
    expect(given.marketingConsentAt).not.toBeNull();

    await updateCustomerProfile(registered.customerId, { marketingConsent: false });
    const withdrawn = must(
      await prisma.customer.findUnique({ where: { id: registered.customerId } }),
      "the customer",
    );
    expect(withdrawn.marketingConsent).toBe(false);
    // Left behind, the timestamp would describe a consent that no longer
    // exists — which is exactly the record somebody would produce as proof.
    expect(withdrawn.marketingConsentAt).toBeNull();
  });
});

describe("the two token systems cannot be swapped", () => {
  it("refuses an admin token as a customer and a customer token as an admin", async () => {
    // ⚠️ Both are signed with the same JWT_SECRET, so the signature alone says
    // nothing about which system issued the token. The `typ` claim does.
    const customerToken = await signCustomerToken({
      sub: "cus_test",
      email: email("typ"),
    });
    const adminToken = await signToken({
      sub: "adm_test",
      email: email("typ-admin"),
      role: "OWNER",
      name: "Test Owner",
    });

    expect(await verifyCustomerToken(customerToken)).not.toBeNull();
    expect(await verifyToken(adminToken)).not.toBeNull();

    expect(await verifyCustomerToken(adminToken)).toBeNull();
    expect(await verifyToken(customerToken)).toBeNull();
  });
});

describe("small rules that are easy to get wrong", () => {
  it("rejects a password that is just the address it protects", () => {
    expect(passwordIsTooCloseToEmail("nicolas123456", "nicolas@example.com")).toBe(true);
    expect(passwordIsTooCloseToEmail("NICOLAS-is-here", "nicolas@example.com")).toBe(true);
    expect(passwordIsTooCloseToEmail("escape-the-ordinary", "nicolas@example.com")).toBe(false);
  });

  it("only ever redirects to a path on this site", () => {
    expect(safeNext("/cart")).toBe("/cart");
    expect(safeNext(undefined)).toBe("/account");
    // The open-redirect shapes: an absolute URL, a protocol-relative one, and
    // the backslash some browsers normalise into a slash.
    expect(safeNext("https://evil.example")).toBe("/account");
    expect(safeNext("//evil.example")).toBe("/account");
    expect(safeNext("/\\evil.example")).toBe("/account");
  });
});
