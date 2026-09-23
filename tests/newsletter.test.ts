import { describe, expect, it, afterAll, afterEach, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import {
  prisma,
  RUN,
  cleanUp,
  must,
  makeProduct,
  completedSession,
  captureCaseStock,
  restoreCaseStock,
  setCaseStock,
} from "./helpers";
import {
  requestSubscription,
  confirmSubscription,
  unsubscribe,
  recordCheckoutConsent,
  drainNewsletterConfirmations,
  purgeUnconfirmedSubscribers,
  NEWSLETTER_PENDING_RETENTION_DAYS,
} from "@/lib/newsletter";
import { buildNewsletterConfirmation } from "@/lib/email";
import { processStripeEvent } from "@/lib/webhooks/process-stripe-event";
import { reserveStock } from "@/lib/inventory";
import { POST as signup } from "@/app/api/newsletter/route";
import { POST as confirmRoute } from "@/app/api/newsletter/confirm/route";

// The limiters are real Upstash when `.env` has the keys, so a few runs in a
// row would exhaust "3 per 10 minutes" and fail the route tests for a reason
// that has nothing to do with them. The limits themselves are configuration;
// what is tested here is what the route does once a request is let through.
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/rate-limit")>();
  const open = { limit: async () => ({ success: true }) };
  return {
    ...real,
    newsletterLimiter: open,
    newsletterAddressLimiter: open,
    newsletterDailyLimiter: open,
  };
});

// D4: consent captured from launch. What these protect is the proof: nobody is
// on the list without an act of their own, and nobody who said no is put back
// by somebody else.

const email = (label: string) => `nl-${label}.${RUN}@example.com`;
const row = (address: string) =>
  prisma.newsletterSubscriber.findUnique({ where: { email: address } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

/** A provider that accepts everything, recording what it was asked to send. */
function stubProvider() {
  vi.stubEnv("RESEND_API_KEY", "re_test_not_a_real_key");
  vi.stubEnv("EMAIL_FROM", "Allternativ <info@send.allternativ.com>");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shop.example");
  const calls: { to: string[] | string; text: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: 200 });
    }),
  );
  return calls;
}

describe("the footer: double opt-in", () => {
  it("leaves a new address PENDING and mails it a link, with no consent yet", async () => {
    const calls = stubProvider();
    const address = email("new");
    const result = await requestSubscription({ email: address, ipHash: "abc" });

    expect(result.mailed).toBe(true);
    const r = must(await row(address), "the subscriber");
    expect(r.status).toBe("PENDING");
    expect(r.source).toBe("footer");
    // Typing is not consenting. The click is.
    expect(r.consentAt).toBeNull();
    expect(r.confirmToken).toBeTruthy();
    expect(r.confirmEmailStatus).toBe("SENT");
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain(`/newsletter/confirm?token=${r.confirmToken}`);
  });

  it("confirms on the link, once, and records when", async () => {
    stubProvider();
    const address = email("confirm");
    await requestSubscription({ email: address, ipHash: null });
    const token = must((await row(address))?.confirmToken, "the token");

    expect(await confirmSubscription(token)).toBe("confirmed");
    const r = must(await row(address), "the subscriber");
    expect(r.status).toBe("SUBSCRIBED");
    expect(r.consentAt).not.toBeNull();
    expect(r.confirmedAt).not.toBeNull();
    expect(r.confirmToken).toBeNull();

    expect(await confirmSubscription(token)).toBe("invalid");
  });

  it("refuses an expired link and leaves the address off the list", async () => {
    stubProvider();
    const address = email("expired");
    await requestSubscription({ email: address, ipHash: null });
    const r = must(await row(address), "the subscriber");
    await prisma.newsletterSubscriber.update({
      where: { id: r.id },
      data: { confirmExpiresAt: new Date(Date.now() - 1000) },
    });

    expect(await confirmSubscription(must(r.confirmToken, "token"))).toBe("expired");
    expect((await row(address))?.status).toBe("PENDING");
  });

  it("sends nothing to an address already on the list", async () => {
    const calls = stubProvider();
    const address = email("already");
    await prisma.$transaction((tx) => recordCheckoutConsent(tx, address));

    const result = await requestSubscription({ email: address, ipHash: null });
    expect(result.mailed).toBe(false);
    expect(calls).toHaveLength(0);
    expect((await row(address))?.confirmToken).toBeNull();
  });

  it("does not put back somebody who unsubscribed until THEY click", async () => {
    stubProvider();
    const address = email("came-back");
    await prisma.$transaction((tx) => recordCheckoutConsent(tx, address));
    const unsubToken = must((await row(address))?.unsubscribeToken, "token");
    expect(await unsubscribe(unsubToken)).toBe(true);

    // A stranger types the address back in.
    await requestSubscription({ email: address, ipHash: null });
    expect((await row(address))?.status).toBe("UNSUBSCRIBED");

    // The owner clicks.
    const token = must((await row(address))?.confirmToken, "token");
    expect(await confirmSubscription(token)).toBe("confirmed");
    expect((await row(address))?.status).toBe("SUBSCRIBED");
  });

  it("keeps the request queued when the provider is down, for the sweep", async () => {
    // No provider configured at all.
    vi.stubEnv("RESEND_API_KEY", "");
    const address = email("queued");
    const result = await requestSubscription({ email: address, ipHash: null });
    expect(result.mailed).toBe(false);
    const r = must(await row(address), "the subscriber");
    expect(r.confirmEmailStatus).toBe("PENDING");
    expect(r.confirmEmailAttempts).toBe(0);

    const calls = stubProvider();
    await drainNewsletterConfirmations();
    expect((await row(address))?.confirmEmailStatus).toBe("SENT");
    expect(calls.some((c) => JSON.stringify(c.to).includes(address))).toBe(true);
  });
});

describe("the confirmation mail", () => {
  it("carries nothing the visitor typed, only our link", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shop.example");
    const mail = buildNewsletterConfirmation("x@example.com", {
      token: "tok",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    expect(mail.text).toContain("https://shop.example/newsletter/confirm?token=tok");
    expect(mail.text).toContain("Somebody asked");
    expect(mail.text).toContain("do nothing");
    expect(mail.replyTo).toBeUndefined();
  });
});

describe("leaving the list", () => {
  it("is immediate and idempotent", async () => {
    const address = email("leave");
    await prisma.$transaction((tx) => recordCheckoutConsent(tx, address));
    const token = must((await row(address))?.unsubscribeToken, "token");

    expect(await unsubscribe(token)).toBe(true);
    const first = must(await row(address), "the subscriber");
    expect(first.status).toBe("UNSUBSCRIBED");
    expect(first.unsubscribedAt).not.toBeNull();

    // A second click must not look like a failure, nor move the date.
    expect(await unsubscribe(token)).toBe(true);
    expect((await row(address))?.unsubscribedAt).toEqual(first.unsubscribedAt);
  });

  it("refuses a token that is not one", async () => {
    expect(await unsubscribe("not-a-token")).toBe(false);
  });
});

describe("the weekly cleanup", () => {
  it("forgets addresses never confirmed, and keeps the ones that said no", async () => {
    stubProvider();
    const stale = email("stale");
    const said_no = email("said-no");
    await requestSubscription({ email: stale, ipHash: null });
    await prisma.$transaction((tx) => recordCheckoutConsent(tx, said_no));
    await unsubscribe(must((await row(said_no))?.unsubscribeToken, "token"));

    const old = new Date(
      Date.now() - (NEWSLETTER_PENDING_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000,
    );
    await prisma.newsletterSubscriber.updateMany({
      where: { email: { in: [stale, said_no] } },
      data: { createdAt: old },
    });

    await purgeUnconfirmedSubscribers();
    expect(await row(stale)).toBeNull();
    expect((await row(said_no))?.status).toBe("UNSUBSCRIBED");
  });
});

describe("the routes", () => {
  function post(
    handler: (request: NextRequest) => Promise<Response>,
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) {
    return handler(
      new NextRequest(`https://shop.example${path}`, {
        method: "POST",
        headers: {
          host: "shop.example",
          origin: "https://shop.example",
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
      }),
    );
  }

  it("answers a new address and a subscribed one identically", async () => {
    stubProvider();
    const subscribed = email("route-subscribed");
    await prisma.$transaction((tx) => recordCheckoutConsent(tx, subscribed));

    const a = await post(signup, "/api/newsletter", { email: email("route-new") });
    const b = await post(signup, "/api/newsletter", { email: subscribed });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await a.json()).toEqual(await b.json());
  });

  it("lower-cases the address, so one person is one row", async () => {
    stubProvider();
    const address = email("case");
    await post(signup, "/api/newsletter", { email: address.toUpperCase() });
    expect(await row(address)).not.toBeNull();
  });

  it("refuses another site posting through a visitor's browser", async () => {
    const res = await post(
      signup,
      "/api/newsletter",
      { email: email("evil") },
      { origin: "https://evil.example" },
    );
    expect(res.status).toBe(403);
    expect(await row(email("evil"))).toBeNull();
  });

  it("answers a bot like a person and stores nothing", async () => {
    const res = await post(signup, "/api/newsletter", {
      email: email("bot"),
      website: "http://spam.example",
    });
    expect(res.status).toBe(200);
    expect(await row(email("bot"))).toBeNull();
  });

  it("confirms through the route", async () => {
    stubProvider();
    const address = email("route-confirm");
    await requestSubscription({ email: address, ipHash: null });
    const token = must((await row(address))?.confirmToken, "token");
    const res = await post(confirmRoute, "/api/newsletter/confirm", { token });
    expect(res.status).toBe(200);
    expect((await row(address))?.status).toBe("SUBSCRIBED");
  });
});

describe("the checkout box", () => {
  let caseStockBefore: Awaited<ReturnType<typeof captureCaseStock>> = [];

  beforeEach(async () => {
    // `makeProduct` makes one product per run, so each purchase starts clean.
    await cleanUp();
    caseStockBefore = await captureCaseStock();
    await setCaseStock("BLACK", 100);
  });

  afterEach(async () => {
    await restoreCaseStock(caseStockBefore);
  });

  async function buy(buyer: string, newsletter: boolean) {
    const { variant } = await makeProduct({ stock: 5 });
    const group = randomUUID();
    await reserveStock([{ variantId: variant.id, quantity: 1, caseKey: "BLACK" }], group);
    await processStripeEvent(
      completedSession({
        sessionId: `cs_${RUN}_nl_${randomUUID()}`,
        email: buyer,
        items: [{ variantId: variant.id, quantity: 1, caseColor: "BLACK" }],
        reservationGroup: group,
        amountTotal: 3900,
        currency: "eur",
        country: "DE",
        newsletter,
      }),
    );
  }

  it("subscribes the buyer who ticked it, straight away", async () => {
    const buyer = email("ticked");
    await buy(buyer, true);
    const r = must(await row(buyer), "the subscriber");
    expect(r.status).toBe("SUBSCRIBED");
    expect(r.source).toBe("checkout");
    expect(r.consentAt).not.toBeNull();
  });

  it("records nothing for a buyer who left it unticked", async () => {
    const buyer = email("unticked");
    await buy(buyer, false);
    expect(await row(buyer)).toBeNull();
    // And buying still did not flip the account's own switch.
    const customer = await prisma.customer.findUnique({ where: { email: buyer } });
    expect(customer?.marketingConsent).toBe(false);
  });
});
