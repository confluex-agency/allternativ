import { PrismaClient } from "@/generated/prisma/client";
import {
  encodeItemsMetadata,
  type CheckoutItem,
} from "@/lib/checkout-metadata";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import type Stripe from "stripe";

// Fixtures for the purchase tests.
//
// Everything created here carries a run-specific suffix so a failed run cannot
// poison the next one, and `cleanUp` removes it by that suffix rather than by
// truncating tables. The local database also holds the real catalogue, and a
// test that wiped it would cost more time than it saves.

export const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

/** Stable within a run, unique between them. */
export const RUN = `test-${process.pid}`;

export async function makeProduct(opts: {
  stock: number;
  /** The case the test colourway is packed in. */
  caseColor?: string | null;
  priceCents?: number;
  supplierCostUsdCents?: number;
  marketPrices?: { market: string; currency: string; priceCents: number }[];
}) {
  const product = await prisma.product.create({
    data: {
      name: `Test Model ${RUN}`,
      slug: `test-model-${RUN}`,
      code: `TST-${RUN}`,
      priceCents: opts.priceCents ?? 3900,
      supplierCostUsdCents: opts.supplierCostUsdCents ?? 338,
      stockQuantity: opts.stock,
      status: "LIVE",
      type: "SUNGLASSES",
      marketPrices: opts.marketPrices
        ? { create: opts.marketPrices }
        : undefined,
      variants: {
        create: {
          sku: `TEST_${RUN}_BLACK`,
          colorKey: "black",
          colorName: "Test Black",
          stockQuantity: opts.stock,
          caseColor: opts.caseColor === undefined ? "BLACK" : opts.caseColor,
          isActive: true,
        },
      },
    },
    include: { variants: true },
  });
  return { product, variant: product.variants[0] };
}

/**
 * The retired case pools, read and never written.
 *
 * Until 2026-09-24 the purchase path drew cases from `case_stock`, a singleton
 * keyed by colour that the suite had to borrow and hand back. The case is now
 * packed with its pair, so the suite only reads the table, to prove that a
 * sale no longer moves it.
 */
export async function caseStockSnapshot() {
  return prisma.caseStock.findMany({ orderBy: { key: "asc" } });
}

/**
 * A `checkout.session.completed` event shaped like the real thing.
 *
 * Built by hand rather than captured from Stripe, so the fields that matter to
 * us are visible in the test instead of buried in three hundred lines of
 * fixture. Anything the handler does not read is left out on purpose: if it
 * starts reading something new, the test should fail rather than silently pass
 * on a field that happens to be there.
 */
export function completedSession(opts: {
  sessionId: string;
  email: string;
  items: CheckoutItem[];
  reservationGroup: string;
  amountTotal: number;
  currency: string;
  country: string;
  discountCents?: number;
  shippingCents?: number;
  /** The cart's newsletter box was ticked. Written exactly as the checkout writes it. */
  newsletter?: boolean;
}): Stripe.Event {
  return {
    id: `evt_${opts.sessionId}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: opts.sessionId,
        amount_total: opts.amountTotal,
        currency: opts.currency,
        customer_details: { email: opts.email, name: "Test Buyer", phone: "+1 555" },
        collected_information: {
          shipping_details: {
            name: "Test Buyer",
            address: {
              line1: "1 Test Street",
              line2: null,
              city: "Testville",
              state: null,
              postal_code: "00000",
              country: opts.country,
            },
          },
        },
        total_details: {
          amount_discount: opts.discountCents ?? 0,
          amount_shipping: opts.shippingCents ?? 0,
        },
        metadata: {
          // Encoded by the same function the checkout route uses, so this test
          // exercises the format production actually writes. The legacy
          // single-key shape is covered by tests/checkout-metadata.test.ts.
          ...encodeItemsMetadata(opts.items),
          reservationGroup: opts.reservationGroup,
          ...(opts.newsletter ? { newsletter: "yes" } : {}),
        },
      },
    },
  } as unknown as Stripe.Event;
}

export async function cleanUp() {
  const orders = await prisma.order.findMany({
    where: { customer: { email: { contains: RUN } } },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);
  if (ids.length) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.customer.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.contactMessage.deleteMany({
    where: { email: { contains: RUN } },
  });
  await prisma.newsletterSubscriber.deleteMany({
    where: { email: { contains: RUN } },
  });
  await prisma.stockReservation.deleteMany({
    where: { variant: { sku: { contains: RUN } } },
  });
  await prisma.productVariant.deleteMany({ where: { sku: { contains: RUN } } });
  await prisma.product.deleteMany({ where: { slug: { contains: RUN } } });

  // ⚠️ Admin users the suite invented, and the audit rows they produced.
  //
  // The audit rows go FIRST and are matched on `entityLabel`, which froze the
  // email at the time. `AuditLog` has no foreign key to `admin_users` — it
  // deliberately keeps `adminEmail` as a plain string so the trail outlives the
  // person — which means nothing deletes these rows for us and a run would
  // otherwise leave a trail of invented owners behind in the real table.
  await prisma.auditLog.deleteMany({
    where: { entityType: "admin_user", entityLabel: { contains: RUN } },
  });
  await prisma.auditLog.deleteMany({ where: { adminEmail: { contains: RUN } } });
  await prisma.adminUser.deleteMany({ where: { email: { contains: RUN } } });
}

/**
 * Unwraps a lookup that must have found something.
 *
 * Nicer than `!` scattered through the assertions: when a row is genuinely
 * missing, the test fails saying which one, instead of failing three lines
 * later on a property of undefined.
 */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what} to exist, found none`);
  }
  return value;
}
