import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { stripe, SUPPORTED_CURRENCIES } from "@/lib/stripe";
import { env } from "@/lib/env";
import { CASE_COLORS, caseLabel } from "@/lib/product-options";

// Checkout prices against ProductVariant, the buyable unit. It used to look up
// Product by an id the cart never held (it sent the product code), so no basket
// could ever be paid for.
//
// Prices are always read from the database here, never taken from the request.
// The cart lives in the visitor's browser and can be edited freely.

const CheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(100),
        caseColor: z.enum(CASE_COLORS),
      }),
    )
    .min(1)
    .max(50),
  currency: z.enum(SUPPORTED_CURRENCIES).default("eur"),
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

    const variantIds = [...new Set(items.map((i) => i.variantId))];
    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        isActive: true,
        product: { status: "LIVE" },
      },
      include: { product: true },
    });

    if (variants.length !== variantIds.length) {
      return NextResponse.json(
        { error: "Some items are no longer available" },
        { status: 400 },
      );
    }

    const byId = new Map(variants.map((v) => [v.id, v]));

    // Refuse the whole basket rather than silently dropping a line: someone who
    // reaches payment expecting three pairs should not be charged for two.
    for (const item of items) {
      const variant = byId.get(item.variantId)!;
      if (variant.stockQuantity < item.quantity) {
        return NextResponse.json(
          {
            error: `${variant.product.name} (${variant.colorName}) does not have enough stock`,
          },
          { status: 409 },
        );
      }
    }

    const lineItems = items.map((item) => {
      const variant = byId.get(item.variantId)!;
      return {
        price_data: {
          currency,
          product_data: {
            name: `${variant.product.name} — ${variant.colorName}`,
            description: `Case: ${caseLabel(item.caseColor)}`,
          },
          // Variant price when it has one, otherwise the product's.
          unit_amount: variant.priceCents ?? variant.product.priceCents,
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      // Without an address and a phone number the supplier cannot dispatch, and
      // the export file reaches them with no recipient.
      shipping_address_collection: {
        allowed_countries: ["IE", "GB", "ES", "FR", "DE", "IT", "PT", "NL", "BE"],
      },
      phone_number_collection: { enabled: true },
      // Lets Stripe's own coupons and promotion codes be redeemed at checkout,
      // so the team can run a discount without a deploy.
      allow_promotion_codes: true,
      success_url: `${env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/cart`,
      metadata: {
        // What the webhook needs to write the order lines, including the case
        // colour, which is not a variant and so cannot be recovered from the SKU.
        items: JSON.stringify(
          items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            caseColor: i.caseColor,
            sku: byId.get(i.variantId)!.sku,
          })),
        ),
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
