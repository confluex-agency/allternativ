import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// NEXT_PUBLIC_APP_URL is the address Stripe returns a shopper to once their
// card has been charged. On 2026-08-24 a staging deployment carried the
// development value into production and a real payment ended on a blank page:
// the money moved, the browser went to `http://localhost:3000`, and nothing in
// the application logged a thing.
//
// `src/lib/env.ts` now refuses to load rather than let that ship. These tests
// are what stop the guard from being quietly weakened later - it only earns its
// place if it actually throws.

const VALID = {
  DATABASE_URL: "mysql://user:pass@127.0.0.1:3307/db",
  JWT_SECRET: "x".repeat(32),
  STRIPE_SECRET_KEY: "sk_test_whatever",
  STRIPE_WEBHOOK_SECRET: "whsec_whatever",
  NEXT_PUBLIC_APP_URL: "https://staging.allternativ.com",
};

/** Load a fresh copy of the module under a given environment. */
async function loadEnv(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...VALID, ...overrides })) {
    if (value === undefined) vi.stubEnv(key, "");
    else vi.stubEnv(key, value);
  }
  return import("@/lib/env");
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe("in production", () => {
  beforeEach(() => vi.stubEnv("NODE_ENV", "production"));

  it("refuses localhost, naming the consequence and the rebuild", async () => {
    await expect(
      loadEnv({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
    ).rejects.toThrow(/localhost/);
    // The message has to say the two things that were not obvious in the
    // moment: that it is a post-payment redirect, and that a restart is not
    // enough because the value is inlined at build time.
    await expect(
      loadEnv({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
    ).rejects.toThrow(/REBUILT/);
  });

  it("refuses every other loopback spelling", async () => {
    for (const host of ["127.0.0.1", "0.0.0.0", "[::1]"]) {
      await expect(
        loadEnv({ NEXT_PUBLIC_APP_URL: `http://${host}:3000` }),
        host,
      ).rejects.toThrow();
    }
  });

  it("refuses plain http, because it is a payment redirect", async () => {
    await expect(
      loadEnv({ NEXT_PUBLIC_APP_URL: "http://staging.allternativ.com" }),
    ).rejects.toThrow(/https/);
  });

  it("refuses a value with no scheme", async () => {
    await expect(
      loadEnv({ NEXT_PUBLIC_APP_URL: "staging.allternativ.com" }),
    ).rejects.toThrow(/valid URL/);
  });

  it("accepts the real staging address", async () => {
    const { env } = await loadEnv({
      NEXT_PUBLIC_APP_URL: "https://staging.allternativ.com",
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://staging.allternativ.com");
  });
});

describe("in development", () => {
  beforeEach(() => vi.stubEnv("NODE_ENV", "development"));

  it("allows localhost, which is the whole point of localhost", async () => {
    const { env } = await loadEnv({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("still refuses something that is not a URL at all", async () => {
    // A typo is a typo in any environment, and this one surfaces as a confusing
    // Stripe error rather than as itself.
    await expect(
      loadEnv({ NEXT_PUBLIC_APP_URL: "not a url" }),
    ).rejects.toThrow(/valid URL/);
  });
});

describe("the checks that were already there", () => {
  it("still refuses a short JWT secret", async () => {
    await expect(loadEnv({ JWT_SECRET: "too-short" })).rejects.toThrow(
      /32 characters/,
    );
  });

  it("still refuses a missing variable", async () => {
    await expect(
      loadEnv({ STRIPE_SECRET_KEY: undefined }),
    ).rejects.toThrow(/Missing required variable: STRIPE_SECRET_KEY/);
  });
});
