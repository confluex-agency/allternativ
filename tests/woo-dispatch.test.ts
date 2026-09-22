import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma, RUN, cleanUp } from "./helpers";
import { GET, PUT, POST, PATCH } from "@/app/wp-json/[...path]/route";
import { EMAIL_MAX_ATTEMPTS } from "@/lib/email";

// The return half of the supplier integration: Dianxiaomi writing a tracking
// number back. It had never run when this was written (no parcel had shipped),
// so these tests stand in for the first real dispatch. What they protect is
// the one silent failure in the chain: a write we do not take means the buyer
// is never told their parcel left.

const EMAIL = `woo-buyer.${RUN}@example.com`;
const KEY = "ck_test_dispatch";
const SECRET = "cs_test_dispatch";
const AUTH = `Basic ${Buffer.from(`${KEY}:${SECRET}`).toString("base64")}`;

beforeEach(() => {
  vi.stubEnv("WOO_CONSUMER_KEY", KEY);
  vi.stubEnv("WOO_CONSUMER_SECRET", SECRET);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.wooRequestLog.deleteMany({
    where: { userAgent: `vitest-${RUN}` },
  });
  await cleanUp();
  await prisma.$disconnect();
});

async function makePaidOrder(suffix: string) {
  const customer = await prisma.customer.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, name: "Woo Buyer" },
  });
  return prisma.order.create({
    data: {
      orderNumber: `WOO-${RUN}-${suffix}`,
      customerId: customer.id,
      status: "PAID",
      subtotalCents: 3900,
      totalCents: 3900,
      currency: "EUR",
    },
  });
}

type Handler = typeof PUT;

function call(handler: Handler, method: string, path: string, body?: unknown) {
  const segments = path.split("/");
  return handler(
    new NextRequest(`https://shop.example/wp-json/${path}`, {
      method,
      headers: {
        authorization: AUTH,
        "content-type": "application/json",
        "user-agent": `vitest-${RUN}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: segments }) },
  );
}

/** Exactly the condition `drainDispatchEmails` sends on. */
async function isDueForDispatchEmail(orderId: string) {
  const due = await prisma.order.findFirst({
    where: {
      id: orderId,
      dispatchEmailStatus: "PENDING",
      status: { in: ["SHIPPED", "DELIVERED"] },
      trackingNumber: { not: null },
      dispatchEmailAttempts: { lt: EMAIL_MAX_ATTEMPTS },
    },
  });
  return due !== null;
}

describe("a tracking number coming back from the supplier", () => {
  const shapes: [string, Handler, string, (id: number) => string, unknown][] = [
    [
      "PUT on the order, as WooCommerce's own API",
      PUT,
      "PUT",
      (id) => `wc/v3/orders/${id}`,
      {
        status: "completed",
        meta_data: [
          { key: "_tracking_number", value: "LP00123456789CN" },
          { key: "_tracking_provider", value: "YunExpress" },
        ],
      },
    ],
    [
      "PATCH on the order, which WordPress treats as the same edit",
      PATCH,
      "PATCH",
      (id) => `wc/v3/orders/${id}`,
      { tracking_number: "LP00123456789CN", tracking_provider: "YunExpress" },
    ],
    [
      "POST to the Shipment Tracking plugin's route",
      POST,
      "POST",
      (id) => `wc-shipment-tracking/v3/orders/${id}/shipment-trackings`,
      { tracking_number: "LP00123456789CN", tracking_provider: "YunExpress" },
    ],
    [
      "POST to Advanced Shipment Tracking's route",
      POST,
      "POST",
      (id) => `wc-ast/v3/orders/${id}/shipment-trackings`,
      { tracking_number: "LP00123456789CN", tracking_provider: "YunExpress" },
    ],
  ];

  it.each(shapes)(
    "%s leaves the order shipped, tracked, and due for the dispatch email",
    async (_label, handler, method, pathFor, body) => {
      const order = await makePaidOrder(`${method}-${shapes.findIndex((s) => s[0] === _label)}`);
      const res = await call(handler, method, pathFor(order.wooId), body);
      expect(res.status).toBeLessThan(300);

      const after = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(after.status).toBe("SHIPPED");
      expect(after.trackingNumber).toBe("LP00123456789CN");
      expect(after.carrier).toBe("YunExpress");
      expect(after.shippedAt).not.toBeNull();
      expect(await isDueForDispatchEmail(order.id)).toBe(true);
    },
  );

  it('reads "completed" as dispatched, never as delivered', async () => {
    const order = await makePaidOrder("completed-only");
    await call(PUT, "PUT", `wc/v3/orders/${order.wooId}`, {
      status: "completed",
    });
    const after = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(after.status).toBe("SHIPPED");
    // No number yet, so nobody is mailed a tracking email with a blank in it.
    expect(await isDueForDispatchEmail(order.id)).toBe(false);
  });

  it("answers the plugin's GET with the tracking entry it expects", async () => {
    const order = await makePaidOrder("plugin-get");
    await call(POST, "POST", `wc/v3/orders/${order.wooId}/shipment-trackings`, {
      tracking_number: "LP999",
    });
    const res = await call(
      GET,
      "GET",
      `wc/v3/orders/${order.wooId}/shipment-trackings`,
    );
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].tracking_number).toBe("LP999");
  });

  it("refuses a write without the supplier's credentials", async () => {
    const order = await makePaidOrder("no-auth");
    const res = await PUT(
      new NextRequest(`https://shop.example/wp-json/wc/v3/orders/${order.wooId}`, {
        method: "PUT",
        headers: { "user-agent": `vitest-${RUN}` },
        body: JSON.stringify({ tracking_number: "LP-FORGED" }),
      }),
      {
        params: Promise.resolve({
          path: ["wc", "v3", "orders", String(order.wooId)],
        }),
      },
    );
    expect(res.status).toBe(401);
    const after = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(after.trackingNumber).toBeNull();
  });
});
