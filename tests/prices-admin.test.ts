import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { prisma, RUN, cleanUp, makeProduct } from "./helpers";
import { setMarketPrice, worstCaseNet } from "@/lib/prices-admin";
import { MINIMUM_NET_CENTS } from "@/lib/margin";
import type { JWTPayload } from "@/lib/auth";

// C5: market prices edited from the admin. Same shape of guard as the stock
// editor (no stale overwrite, a reason on every change), plus the one that is
// peculiar to a price: it may not make an order lose money.

let actor: JWTPayload;
let slug: string;

beforeAll(async () => {
  const admin = await prisma.adminUser.create({
    data: {
      email: `price-actor.${RUN}@example.com`,
      name: "Price Actor",
      role: "ECOMMERCE_ADMIN",
      passwordHash: "not-a-real-hash",
    },
  });
  actor = {
    sub: admin.id,
    email: admin.email,
    role: "ECOMMERCE_ADMIN",
    name: admin.name,
  } as JWTPayload;

  const { product } = await makeProduct({
    stock: 5,
    supplierCostUsdCents: 540,
    marketPrices: [{ market: "EU", currency: "eur", priceCents: 3900 }],
  });
  slug = product.slug;
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

async function euPrice() {
  const row = await prisma.marketPrice.findFirst({
    where: { market: "EU", product: { slug } },
  });
  return row?.priceCents ?? null;
}

describe("the worst order at a price", () => {
  it("is comfortably positive at the launch price", () => {
    const worst = worstCaseNet(540, "EU", 3900);
    expect(worst).not.toBeNull();
    expect(worst!.netCents).toBeGreaterThan(MINIMUM_NET_CENTS);
  });

  it("goes negative when the price is below what the parcel and the pair cost", () => {
    expect(worstCaseNet(540, "EU", 900)!.netCents).toBeLessThan(0);
  });

  it("says it cannot tell when the model has no cost", () => {
    expect(worstCaseNet(null, "EU", 3900)).toBeNull();
  });
});

describe("changing a market price", () => {
  it("writes the new figure and records who, what and why", async () => {
    const result = await setMarketPrice({
      slug,
      market: "EU",
      priceCents: 4200,
      expected: 3900,
      allModels: false,
      reason: "launch positioning",
      actor,
    });
    expect(result.ok).toBe(true);
    expect(await euPrice()).toBe(4200);

    const audit = await prisma.auditLog.findFirst({
      where: { adminEmail: actor.email, entityType: "market_price" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.oldValue).toMatchObject({ priceCents: 3900 });
    expect(audit?.newValue).toMatchObject({
      priceCents: 4200,
      reason: "launch positioning",
    });
  });

  it("refuses to overwrite a price that moved while the form was open", async () => {
    const result = await setMarketPrice({
      slug,
      market: "EU",
      priceCents: 3500,
      expected: 3900, // what the form showed; the row says 4200 now
      allModels: false,
      reason: "stale tab",
      actor,
    });
    expect(result).toMatchObject({ ok: false, reason: "stale" });
    expect(await euPrice()).toBe(4200);
  });

  it("refuses a price that would make an order lose money", async () => {
    const result = await setMarketPrice({
      slug,
      market: "EU",
      priceCents: 900,
      expected: 4200,
      allModels: false,
      reason: "typo",
      actor,
    });
    expect(result).toMatchObject({ ok: false, reason: "below-cost" });
    expect(await euPrice()).toBe(4200);
  });

  it("creates the row for a market that had none", async () => {
    const result = await setMarketPrice({
      slug,
      market: "GB",
      priceCents: 3400,
      expected: null,
      allModels: false,
      reason: "first UK price",
      actor,
    });
    expect(result.ok).toBe(true);
    const row = await prisma.marketPrice.findFirst({
      where: { market: "GB", product: { slug } },
    });
    expect(row).toMatchObject({ priceCents: 3400, currency: "gbp" });
  });

  it("refuses a whole-line change when the models do not all show the same figure", async () => {
    // The test model is at 42 in Europe; the catalogue in the local database
    // is not. Nothing may be written to any of them.
    const before = await prisma.marketPrice.findMany({
      where: { market: "EU" },
      select: { id: true, priceCents: true },
      orderBy: { id: "asc" },
    });
    const result = await setMarketPrice({
      slug,
      market: "EU",
      priceCents: 4500,
      expected: 4200,
      allModels: true,
      reason: "line-wide",
      actor,
    });
    expect(result).toMatchObject({ ok: false, reason: "stale" });
    const after = await prisma.marketPrice.findMany({
      where: { market: "EU" },
      select: { id: true, priceCents: true },
      orderBy: { id: "asc" },
    });
    expect(after).toEqual(before);
  });
});

describe("a discount on the worst basket", () => {
  it("costs more margin the deeper it goes, and a deep one sinks some baskets", async () => {
    const { basketsAt } = await import("@/lib/prices-admin");
    const at = (pct: number) =>
      Math.min(...(basketsAt(540, "EU", 3900, pct) ?? []).map((b) => b.netCents));
    expect(at(10)).toBeLessThan(at(0));
    expect(at(80)).toBeLessThan(0);
  });
});
