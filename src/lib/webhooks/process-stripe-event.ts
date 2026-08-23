// What actually happens when a Stripe event arrives.
//
// Kept out of the route so the same code can be run again later against a stored
// event: the route records what came in, this decides what it means. That split
// is the useful half of a message queue, without a broker to operate.

import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { usdCentsTo, supplierCostUsdCents } from "@/lib/shipping";
import { marketForCountry } from "@/lib/markets";
import { netCents } from "@/lib/margin";
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
    include: { product: { include: { marketPrices: true } } },
  });
  if (variants.length !== variantIds.length) {
    throw new UnprocessableEventError(
      "Some purchased variants no longer exist",
    );
  }
  const byId = new Map(variants.map((v) => [v.id, v]));

  // ── Which market this order was priced in ───────────────────────────────
  //
  // ⚠️ This was a real bug for the length of one afternoon. The line items were
  // recorded at `product.priceCents`, which is the EURO price, while the
  // customer had been charged their own market's. An order from the United
  // Kingdom went into the books at 39 when 34 had actually been taken, and
  // nothing failed: the order total is Stripe's own `amount_total` and was
  // right, so only the per-line figures and the subtotal were wrong. Margin
  // reporting would have quietly overstated revenue on five of six markets.
  //
  // Derived from where the parcel is going, exactly as the checkout derived it,
  // rather than trusted from anywhere. The address is read early for this;
  // it is used again further down for the delivery cost.
  const shippingDetails = session.collected_information?.shipping_details ?? null;
  const destinationCountry =
    shippingDetails?.address?.country?.toUpperCase() ?? null;
  const market = destinationCountry ? marketForCountry(destinationCountry) : null;

  const marketPriceFor = (variant: (typeof variants)[number]): number => {
    // A colourway with its own price keeps it, as at the checkout.
    if (variant.priceCents !== null) return variant.priceCents;
    if (market) {
      const row = variant.product.marketPrices.find((p) => p.market === market);
      if (row) return row.priceCents;
    }
    return variant.product.priceCents;
  };

  const orderItems = items.map((item) => {
    const variant = byId.get(item.variantId)!;
    return {
      productId: variant.productId,
      variantId: variant.id,
      quantity: item.quantity,
      unitPriceCents: marketPriceFor(variant),
      // Snapshots — what the supplier must ship, whatever happens to the
      // catalogue later.
      sku: variant.sku,
      productName: variant.product.name,
      variantName: variant.colorName,
      caseColor: item.caseColor,
      // The cost side of the same snapshot, in the order's currency.
      //
      // Frozen for exactly the reason the price above is: the catalogue moves
      // on. The difference is that a price can at least be recovered from an
      // old invoice, while nobody anywhere writes down what a thing used to
      // cost. Miss it now and last quarter's margin can never be answered.
      //
      // Null when the product has no cost recorded, which reads as "unknown"
      // in reporting. Zero would read as "free" and quietly inflate the margin.
      unitCostCents: usdCentsTo(
        variant.product.supplierCostUsdCents,
        session.currency || "eur",
      ),
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
  // Read above, where the market is worked out from it.
  const shipping = shippingDetails;
  const shippingAddress = shipping?.address ?? null;

  // ── The cost side, frozen with the rest ─────────────────────────────────
  //
  // What the parcel costs us, which is NOT what the customer paid for it: from
  // two pairs up delivery is free to them and absorbed whole by Allternativ.
  const pairs = orderItems.reduce((n, i) => n + i.quantity, 0);
  const destination = destinationCountry;
  const shippingCostCents = destination
    ? (usdCentsTo(
        // The tier for THIS many pairs, not the one-pair rate: a two-pair
        // parcel genuinely costs more to send, and costing it at the single
        // rate would flatter the free-shipping rule by understating it.
        supplierCostUsdCents(destination, pairs),
        session.currency || "eur",
      ) ?? 0)
    : 0;

  // Stripe's cut, read from the balance transaction. Best-effort on purpose:
  // this is a reporting nicety and must never be the reason an order fails to
  // be recorded. Null means "not read", which reporting can tell from zero.
  //
  // Captured now rather than looked up later because it is only cheaply
  // available while the payment is fresh, and because a margin that ignores the
  // processor's fee flatters itself by two or three per cent.
  let paymentFeeCents: number | null = null;
  try {
    if (typeof session.payment_intent === "string") {
      const intent = await stripe.paymentIntents.retrieve(
        session.payment_intent,
        { expand: ["latest_charge.balance_transaction"] },
      );
      const charge = intent.latest_charge;
      if (charge && typeof charge !== "string") {
        const balance = charge.balance_transaction;
        if (balance && typeof balance !== "string") {
          paymentFeeCents = balance.fee;
        }
      }
    }
  } catch {
    paymentFeeCents = null;
  }

  // ⚠️ The second of two nets, and the one that is true.
  //
  // The checkout refuses a discount code that would take the order below the
  // floor, but it has to estimate Stripe's cut, because nobody knows what card
  // is coming. This one reads the fee Stripe actually charged. So an order that
  // passed the floor by a few cents on a European card can still arrive here
  // slightly under on a card from further away.
  //
  // It only shouts. Refusing a payment that has already happened is not a
  // thing; that job belongs at the checkout, and it is done there now.
  const goodsCostCents = orderItems.reduce(
    (sum, i) => sum + (i.unitCostCents ?? 0) * i.quantity,
    0,
  );
  // The same arithmetic the checkout used to refuse the order, run again on
  // what actually happened. Shared so the two can never disagree: the checkout
  // works from an estimated Stripe fee, this one from the real charge, and a
  // borderline order the estimate let through can still land under.
  const net = netCents({
    revenueCents: totalCents,
    goodsCostCents,
    shippingCostCents,
    paymentFeeCents: paymentFeeCents ?? 0,
  });
  if (net < 0) {
    console.error(
      `[margin] Order from session ${session.id} closes NEGATIVE: ` +
        `revenue ${totalCents}, goods ${goodsCostCents}, shipping ${shippingCostCents}, ` +
        `fee ${paymentFeeCents ?? "?"} → ${net} ${session.currency?.toUpperCase()}` +
        (promotionCode ? `. Promotion code: ${promotionCode}` : "") +
        (pairs >= 2 ? ". Delivery was absorbed (2+ pairs)." : ""),
    );
  }

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
        shippingCostCents,
        paymentFeeCents,
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
  // landed. This should now be unreachable in normal operation: the reservation
  // outlives the payment page by RESERVATION_GRACE_MINUTES, and Stripe will not
  // charge an expired session. It is kept as a net for the abnormal case, such
  // as a webhook delayed for hours by an outage. The order stands either way,
  // because the money is real, so the units come off stock late instead.
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
      // The case left with it, so it comes off its pool too.
      await prisma.caseStock.updateMany({
        where: { key: item.caseColor },
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
