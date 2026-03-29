import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email;

    if (!customerEmail) {
      return NextResponse.json({ received: true });
    }

    // Upsert customer
    const customer = await prisma.customer.upsert({
      where: { email: customerEmail },
      update: {
        name: session.customer_details?.name || undefined,
      },
      create: {
        email: customerEmail,
        name: session.customer_details?.name || null,
        country: session.customer_details?.address?.country || null,
        city: session.customer_details?.address?.city || null,
        stripeCustomerId:
          typeof session.customer === "string" ? session.customer : null,
      },
    });

    // Parse items from metadata
    const items = JSON.parse(session.metadata?.items || "[]") as Array<{
      productId: string;
      quantity: number;
    }>;

    // Get product prices
    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
    });

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
      0
    );
    const totalCents = session.amount_total || subtotalCents;

    // Create order
    await prisma.order.create({
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

    // Update customer stats
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalSpentCents: { increment: totalCents },
        orderCount: { increment: 1 },
      },
    });

    // Decrement stock
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
    }
  }

  return NextResponse.json({ received: true });
}
