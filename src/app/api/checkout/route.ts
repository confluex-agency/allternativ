import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { items, currency = "usd" } = await request.json();

    if (!SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency)) {
      return NextResponse.json(
        { error: "Unsupported currency" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items are required" },
        { status: 400 }
      );
    }

    // Fetch products from DB to get real prices
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "Some products are unavailable" },
        { status: 400 }
      );
    }

    const lineItems = items.map(
      (item: { productId: string; quantity: number }) => {
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
      }
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cart`,
      metadata: {
        items: JSON.stringify(
          items.map((i: { productId: string; quantity: number }) => ({
            productId: i.productId,
            quantity: i.quantity,
          }))
        ),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
