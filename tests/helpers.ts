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
          isActive: true,
        },
      },
    },
    include: { variants: true },
  });
  return { product, variant: product.variants[0] };
}

/** Case stock, kept apart from the eyewear because it is a separate pool. */
export async function setCaseStock(key: string, stockQuantity: number) {
  await prisma.caseStock.upsert({
    where: { key },
    update: { stockQuantity },
    create: { key, name: key, stockQuantity },
  });
}

/**
 * Borrow the case-stock table, and give it back.
 *
 * ⚠️ `case_stock` is a singleton keyed by colour. Unlike products, the suite
 * cannot make itself a private row: the purchase path reserves against BLACK
 * and WHITE, which are the same two rows the development shop sells from. So
 * `setCaseStock` rewrites real local inventory, and it does it silently.
 *
 * That already cost time once. After a five-line test purchase had correctly
 * taken three black cases and two white ones, a run of this suite put both
 * pools back to 100, and the next person to look saw stock that had apparently
 * un-sold itself — a convincing inventory bug that was nothing of the sort.
 *
 * Nothing here is a production concern: the shop never runs its own tests. It
 * is a development concern, and the same one the project already has about
 * pointing DATABASE_URL at Hostinger.
 */
export async function captureCaseStock() {
  return prisma.caseStock.findMany({ orderBy: { key: "asc" } });
}

export async function restoreCaseStock(
  snapshot: Awaited<ReturnType<typeof captureCaseStock>>,
): Promise<void> {
  // Any row the suite invented and the shop never had.
  await prisma.caseStock.deleteMany({
    where: { key: { notIn: snapshot.map((c) => c.key) } },
  });
  for (const row of snapshot) {
    await prisma.caseStock.upsert({
      where: { key: row.key },
      update: { stockQuantity: row.stockQuantity, isActive: row.isActive },
      create: row,
    });
  }
}

export async function caseStockOf(key: string): Promise<number> {
  const row = await prisma.caseStock.findUnique({ where: { key } });
  return row?.stockQuantity ?? 0;
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
  await prisma.stockReservation.deleteMany({
    where: { variant: { sku: { contains: RUN } } },
  });
  await prisma.productVariant.deleteMany({ where: { sku: { contains: RUN } } });
  await prisma.product.deleteMany({ where: { slug: { contains: RUN } } });
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
