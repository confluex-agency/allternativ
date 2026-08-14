import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { stripe, SUPPORTED_CURRENCIES } from "@/lib/stripe";
import { env } from "@/lib/env";
import { CASE_COLORS, caseLabel } from "@/lib/product-options";
import {
  reserveStock,
  releaseReservationGroup,
  attachSessionToReservations,
  OutOfStockError,
  RESERVATION_MINUTES,
} from "@/lib/inventory";

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

    // Take the stock now, before sending anyone to pay. Checking here and
    // decrementing after payment leaves minutes in which everyone is told the
    // last unit is theirs. See src/lib/inventory.ts.
    const reservationGroup = randomUUID();
    try {
      await reserveStock(
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        reservationGroup,
      );
    } catch (error) {
      if (error instanceof OutOfStockError) {
        const variant = byId.get(error.variantId);
        return NextResponse.json(
          {
            error: variant
              ? `${variant.product.name} (${variant.colorName}) has just sold out`
              : "One of the items has just sold out",
          },
          { status: 409 },
        );
      }
      throw error;
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

    let session;
    try {
      session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      // The session dies at the same moment the stock reservation does, so an
      // abandoned checkout cannot hold a unit any longer than it holds a price.
      expires_at: Math.floor(Date.now() / 1000) + RESERVATION_MINUTES * 60,
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
        reservationGroup,
      },
      });
    } catch (error) {
      // Stripe refused the session, so nobody is going to pay for this stock.
      // Hand it straight back instead of waiting for it to time out.
      await releaseReservationGroup(reservationGroup);
      throw error;
    }

    await attachSessionToReservations(reservationGroup, session.id);

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
