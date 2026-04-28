import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { generateOrderNumber } from "@/lib/utils";

const ItemsMetadataSchema = z.array(
  z.object({
    productId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(100),
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

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });
  if (products.length !== items.length) {
    return NextResponse.json(
      { error: "Some products not found" },
      { status: 400 },
    );
  }

  const orderItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents: product.priceCents,
    };
  });

  const subtotalCents = orderItems.reduce(
    (sum, i) => sum + i.unitPriceCents * i.quantity,
    0,
  );
  const totalCents = session.amount_total || subtotalCents;

  try {
    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: customerEmail },
        update: {
          name: session.customer_details?.name || undefined,
          totalSpentCents: { increment: totalCents },
          orderCount: { increment: 1 },
        },
        create: {
          email: customerEmail,
          name: session.customer_details?.name || null,
          country: session.customer_details?.address?.country || null,
          city: session.customer_details?.address?.city || null,
          stripeCustomerId:
            typeof session.customer === "string" ? session.customer : null,
          totalSpentCents: totalCents,
          orderCount: 1,
        },
      });

      await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: customer.id,
          status: "PAID",
          subtotalCents,
          totalCents,
          currency: (session.currency || "usd").toUpperCase(),
          stripeSessionId: session.id,
          shippingName: session.customer_details?.name || null,
          shippingAddress: session.customer_details?.address?.line1 || null,
          shippingCity: session.customer_details?.address?.city || null,
          shippingCountry: session.customer_details?.address?.country || null,
          shippingZip: session.customer_details?.address?.postal_code || null,
          items: { create: orderItems },
        },
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
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
