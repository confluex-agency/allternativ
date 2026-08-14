// What actually happens when a Stripe event arrives.
//
// Kept out of the route so the same code can be run again later against a stored
// event: the route records what came in, this decides what it means. That split
// is the useful half of a message queue, without a broker to operate.

import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/utils";
import { CASE_COLORS } from "@/lib/product-options";
import {
  consumeReservationGroup,
  releaseReservationGroup,
} from "@/lib/inventory";
import { z } from "zod";

const ItemsMetadataSchema = z.array(
  z.object({
    variantId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(100),
    caseColor: z.enum(CASE_COLORS),
    sku: z.string().min(1).max(64),
  }),
);

/** Thrown for events that will never succeed, so they are not retried forever. */
export class UnprocessableEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnprocessableEventError";
  }
}

export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCompletedSession(event.data.object);
      return;
    case "checkout.session.expired":
      await handleExpiredSession(event.data.object);
      return;
    default:
      // Everything else is recorded and ignored on purpose.
      return;
  }
}

/** The shopper walked away. Put the stock back rather than wait for the sweep. */
async function handleExpiredSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const group = session.metadata?.reservationGroup;
  if (group) await releaseReservationGroup(group);
}

async function handleCompletedSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const customerEmail = session.customer_details?.email;
  if (!customerEmail) {
    throw new UnprocessableEventError("Session has no customer email");
  }

  // Idempotency: this session may already have become an order, either because
  // Stripe retried or because we replayed the event by hand.
  const existingOrder = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (existingOrder) return;

  const itemsParsed = ItemsMetadataSchema.safeParse(
    JSON.parse(session.metadata?.items || "[]"),
  );
  if (!itemsParsed.success) {
    throw new UnprocessableEventError("Session metadata is not readable");
  }
  const items = itemsParsed.data;
  const reservationGroup = session.metadata?.reservationGroup ?? null;

  const variantIds = [...new Set(items.map((i) => i.variantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true },
  });
  if (variants.length !== variantIds.length) {
    throw new UnprocessableEventError("Some purchased variants no longer exist");
  }
  const byId = new Map(variants.map((v) => [v.id, v]));

  const orderItems = items.map((item) => {
    const variant = byId.get(item.variantId)!;
    return {
      productId: variant.productId,
      variantId: variant.id,
      quantity: item.quantity,
      unitPriceCents: variant.priceCents ?? variant.product.priceCents,
      // Snapshots — what the supplier must ship, whatever happens to the
      // catalogue later.
      sku: variant.sku,
      productName: variant.product.name,
      variantName: variant.colorName,
      caseColor: item.caseColor,
    };
  });

  const subtotalCents = orderItems.reduce(
    (sum, i) => sum + i.unitPriceCents * i.quantity,
    0,
  );
  const totalCents = session.amount_total ?? subtotalCents;
  const discountCents = session.total_details?.amount_discount ?? 0;
  const shippingCents = session.total_details?.amount_shipping ?? 0;

  // The code the customer actually typed. Stripe only returns the promotion's
  // id on the session, so it has to be expanded. A failure here must not cost
  // us the order, hence the fallback to null.
  let promotionCode: string | null = null;
  if (discountCents > 0) {
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["discounts.promotion_code"],
      });
      const discount = full.discounts?.[0]?.promotion_code;
      if (discount && typeof discount !== "string") {
        promotionCode = discount.code;
      }
    } catch {
      promotionCode = null;
    }
  }

  // Shipping address is collected by Checkout and is where the parcel goes; the
  // billing address on customer_details can be a different place entirely.
  const shipping = session.collected_information?.shipping_details ?? null;
  const shippingAddress = shipping?.address ?? null;

  let reservationHeld = false;

  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { email: customerEmail },
      update: {
        name: session.customer_details?.name || undefined,
        phone: session.customer_details?.phone || undefined,
        totalSpentCents: { increment: totalCents },
        orderCount: { increment: 1 },
      },
      create: {
        email: customerEmail,
        name: session.customer_details?.name || null,
        phone: session.customer_details?.phone || null,
        country: session.customer_details?.address?.country || null,
        city: session.customer_details?.address?.city || null,
        stripeCustomerId:
          typeof session.customer === "string" ? session.customer : null,
        totalSpentCents: totalCents,
        orderCount: 1,
        // Buying is not opting in to marketing (section 25). Consent is only
        // ever recorded where it was actually given.
        marketingConsent: false,
      },
    });

    await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: customer.id,
        status: "PAID",
        subtotalCents,
        shippingCents,
        discountCents,
        promotionCode,
        totalCents,
        currency: (session.currency || "eur").toUpperCase(),
        stripeSessionId: session.id,
        shippingName: shipping?.name ?? session.customer_details?.name ?? null,
        shippingAddress: shippingAddress?.line1 ?? null,
        shippingAddress2: shippingAddress?.line2 ?? null,
        shippingCity: shippingAddress?.city ?? null,
        shippingState: shippingAddress?.state ?? null,
        shippingCountry: shippingAddress?.country ?? null,
        shippingZip: shippingAddress?.postal_code ?? null,
        shippingPhone: session.customer_details?.phone ?? null,
        items: { create: orderItems },
      },
    });

    // The units left stock when the checkout started, so paying only closes the
    // reservation. Nothing is decremented twice.
    if (reservationGroup) {
      reservationHeld = await consumeReservationGroup(tx, reservationGroup);
    }
  });

  // The reservation timed out and its units went back on sale before the payment
  // landed. Rare, but real: someone leaves the Stripe page open past the window
  // and pays anyway. The order stands, because the money is real, so the units
  // have to come off stock now instead.
  //
  // This is allowed to drive stock negative, and that is the point: a negative
  // figure means the shop owes more than it holds, and `reserveStock` refuses
  // every further sale of that variant until a human sorts it out.
  if (reservationGroup && !reservationHeld) {
    for (const item of items) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
    }
    console.error(
      `[stock] Session ${session.id} was paid after its reservation expired. ` +
        `Stock taken late for: ${items.map((i) => i.sku).join(", ")}. ` +
        `Check for a negative figure on those variants.`,
    );
  }
}
