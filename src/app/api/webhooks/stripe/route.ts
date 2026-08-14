import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { generateOrderNumber } from "@/lib/utils";
import { CASE_COLORS } from "@/lib/product-options";

// Turns a paid Stripe session into an order.
//
// The order is a permanent commercial record, so every line copies what was
// actually bought — SKU, product name, colourway and case colour — instead of
// pointing at a catalogue that the admin can edit afterwards (sections 21 and
// 24 of the client brief).

const ItemsMetadataSchema = z.array(
  z.object({
    variantId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(100),
    caseColor: z.enum(CASE_COLORS),
    sku: z.string().min(1).max(64),
  }),
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const customerEmail = session.customer_details?.email;
  if (!customerEmail) {
    return NextResponse.json({ received: true });
  }

  // Idempotency: if we already processed this Stripe session, ignore
  const existingOrder = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (existingOrder) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  const itemsParsed = ItemsMetadataSchema.safeParse(
    JSON.parse(session.metadata?.items || "[]"),
  );
  if (!itemsParsed.success) {
    return NextResponse.json(
      { error: "Invalid items metadata" },
      { status: 400 },
    );
  }
  const items = itemsParsed.data;

  const variantIds = [...new Set(items.map((i) => i.variantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true },
  });
  if (variants.length !== variantIds.length) {
    return NextResponse.json({ error: "Some items not found" }, { status: 400 });
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

  try {
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

      // Stock lives on the variant, which is the unit that gets shipped.
      for (const item of items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }
    });
  } catch {
    // Stripe will retry on 5xx, idempotency check above prevents dup
    return NextResponse.json(
      { error: "Failed to persist order" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
