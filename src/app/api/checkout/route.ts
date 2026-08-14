import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { stripe, SUPPORTED_CURRENCIES } from "@/lib/stripe";
import { env } from "@/lib/env";

const CheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(50),
  currency: z.enum(SUPPORTED_CURRENCIES).default("usd"),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = CheckoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid checkout payload" },
        { status: 400 },
      );
    }
    const { items, currency } = parsed.data;

    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: "LIVE" },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "Some products are unavailable" },
        { status: 400 },
      );
    }

    const lineItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return {
        price_data: {
          currency,
          product_data: {
            name: product.name,
            description: product.description || undefined,
          },
          unit_amount: product.priceCents,
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/cart`,
      metadata: {
        items: JSON.stringify(items),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
