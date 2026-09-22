import { describe, expect, it, afterAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma, RUN, cleanUp } from "./helpers";
import {
  ContactSchema,
  submitContactMessage,
  drainContactMessages,
} from "@/lib/contact";
import { buildContactNotification, oneLine } from "@/lib/email";
import { COMPANY } from "@/lib/legal";
import { POST } from "@/app/api/contact/route";

const email = (label: string) => `${label}.${RUN}@example.com`;

const valid = {
  name: "Ana Pérez",
  email: "ana@example.com",
  topic: "CUSTOM",
  message: "Hello,\nDo you make these in a smaller size?",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

/** A provider that answers `status`, recording what it was asked to send. */
function stubProvider(status: number) {
  vi.stubEnv("RESEND_API_KEY", "re_test_not_a_real_key");
  vi.stubEnv("EMAIL_FROM", "Allternativ <info@send.allternativ.com>");
  const calls: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response(status < 300 ? "{}" : "refused", { status });
    }),
  );
  return calls;
}

describe("what the form accepts", () => {
  it("accepts a normal message and keeps its line breaks", () => {
    const parsed = ContactSchema.parse(valid);
    expect(parsed.message).toBe(valid.message);
  });

  it("flattens a name that tries to start a new header line", () => {
    const parsed = ContactSchema.parse({
      ...valid,
      name: "Ana\r\nBcc: victim@example.com",
    });
    expect(parsed.name).not.toMatch(/[\r\n]/);
    expect(parsed.name).toBe("Ana Bcc: victim@example.com");
  });

  it("strips control characters from the message but not the text", () => {
    const parsed = ContactSchema.parse({
      ...valid,
      message: "line one\u0000\u0007\r\nline two",
    });
    expect(parsed.message).toBe("line one\nline two");
  });

  it("refuses a topic that is not on the menu", () => {
    expect(
      ContactSchema.safeParse({ ...valid, topic: "Buy now!!" }).success,
    ).toBe(false);
  });

  it("refuses what is not an email, and what is too long", () => {
    expect(ContactSchema.safeParse({ ...valid, email: "nope" }).success).toBe(
      false,
    );
    expect(
      ContactSchema.safeParse({ ...valid, message: "x".repeat(5001) }).success,
    ).toBe(false);
  });

  it("refuses a message that is only whitespace", () => {
    expect(ContactSchema.safeParse({ ...valid, message: "  \n " }).success).toBe(
      false,
    );
  });
});

describe("the email that reaches the support inbox", () => {
  const built = buildContactNotification({
    name: "Ana\nPérez",
    email: "ana@example.com",
    topic: "PRESS",
    message: "<script>alert(1)</script>",
    receivedAt: new Date("2026-09-22T18:30:00Z"),
  });

  it("goes to the support address and nowhere else", () => {
    expect(built.to).toBe(COMPANY.contactEmail);
  });

  it("replies to the visitor, so answering is pressing Reply", () => {
    expect(built.replyTo).toBe("ana@example.com");
  });

  it("builds its subject from the menu label, on one line", () => {
    expect(built.subject).toBe("[Contact · Press / collaboration] Ana Pérez");
    expect(built.subject).not.toMatch(/[\r\n]/);
  });

  it("carries the message as text, not as markup", () => {
    expect(built.text).toContain("<script>alert(1)</script>");
    expect(built).not.toHaveProperty("html");
  });

  it("oneLine also removes the Unicode line separators", () => {
    const [ls, ps] = [String.fromCharCode(0x2028), String.fromCharCode(0x2029)];
    expect(oneLine(`a${ls}b${ps}c`)).toBe("a b c");
  });
});

describe("a message is stored before anything is sent", () => {
  it("stays PENDING, attempts untouched, when there is no provider", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { id, sent } = await submitContactMessage({
      ...ContactSchema.parse({ ...valid, email: email("noprovider") }),
    });
    expect(sent).toBe(false);

    const row = await prisma.contactMessage.findUniqueOrThrow({ where: { id } });
    expect(row.emailStatus).toBe("PENDING");
    expect(row.emailAttempts).toBe(0);
  });

  it("is SENT on the first try when the provider accepts it", async () => {
    const calls = stubProvider(200);
    const { id, sent } = await submitContactMessage(
      ContactSchema.parse({ ...valid, email: email("accepted") }),
    );
    expect(sent).toBe(true);

    const row = await prisma.contactMessage.findUniqueOrThrow({ where: { id } });
    expect(row.emailStatus).toBe("SENT");
    expect(calls[0].to).toBe(COMPANY.contactEmail);
    expect(calls[0].reply_to).toBe(email("accepted"));
  });

  it("is retried by the sweep after a failure it can recover from", async () => {
    stubProvider(503);
    const { id } = await submitContactMessage(
      ContactSchema.parse({ ...valid, email: email("flaky") }),
    );
    const failed = await prisma.contactMessage.findUniqueOrThrow({
      where: { id },
    });
    expect(failed.emailStatus).toBe("PENDING");
    expect(failed.emailAttempts).toBe(1);

    stubProvider(200);
    const result = await drainContactMessages();
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const row = await prisma.contactMessage.findUniqueOrThrow({ where: { id } });
    expect(row.emailStatus).toBe("SENT");
  });

  it("is given up at once on a refusal retrying cannot fix", async () => {
    stubProvider(422);
    const { id } = await submitContactMessage(
      ContactSchema.parse({ ...valid, email: email("refused") }),
    );
    const row = await prisma.contactMessage.findUniqueOrThrow({ where: { id } });
    expect(row.emailStatus).toBe("FAILED");
    expect(row.emailLastError).toContain("422");
  });
});

describe("the route", () => {
  function post(body: unknown, headers: Record<string, string> = {}) {
    return POST(
      new NextRequest("https://shop.example/api/contact", {
        method: "POST",
        headers: {
          host: "shop.example",
          origin: "https://shop.example",
          "content-type": "application/json",
          ...headers,
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  }

  it("refuses a post from another site", async () => {
    const res = await post(valid, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("refuses a post with no origin at all", async () => {
    const req = new NextRequest("https://shop.example/api/contact", {
      method: "POST",
      headers: { host: "shop.example", "content-type": "application/json" },
      body: JSON.stringify(valid),
    });
    expect((await POST(req)).status).toBe(403);
  });

  it("refuses an oversized body before parsing it", async () => {
    const res = await post("x".repeat(30_000));
    expect(res.status).toBe(413);
  });

  it("refuses what the schema refuses", async () => {
    const res = await post({ ...valid, topic: "SPAM" });
    expect(res.status).toBe(400);
  });

  it("answers a bot exactly like a person, and stores nothing", async () => {
    const address = email("bot");
    const res = await post({ ...valid, email: address, website: "http://x" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(
      await prisma.contactMessage.count({ where: { email: address } }),
    ).toBe(0);
  });
});
