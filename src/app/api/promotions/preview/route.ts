// What a discount code is worth on the basket in front of the customer.
//
// Advisory only. It exists so the cart can show a total that moves when a code
// is typed, instead of a total that sits still until the payment page. Nothing
// here is trusted later: /api/checkout recomputes the whole thing from the
// database and would refuse the code again if anything had changed.
//
// It calls exactly the same function the checkout calls, on purpose. Two
// implementations of "what does this code do" would eventually disagree, and
// that failure looks, from outside, like a shop that quoted one price and
// charged another.
//
// ⚠️ It does NOT reserve stock. Looking at a price is not buying.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SUPPORTED_CURRENCIES } from "@/lib/stripe";
import { CASE_COLORS } from "@/lib/product-options";
import { evaluateDiscountForBasket } from "@/lib/promotions";
import { promoCodeLimiter, getClientIp } from "@/lib/rate-limit";

const PreviewSchema = z.object({
  code: z.string().trim().min(1).max(64),
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
  destinationCountry: z.string().length(2).toUpperCase(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = PreviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { code, items, currency, destinationCountry } = parsed.data;

    // Same bucket as the checkout's, so the two share one budget of attempts.
    // Separate buckets would double the ceiling for anyone willing to alternate
    // between the endpoints, which is the first thing anyone would try.
    //
    // Fails open, and here that matters less than at the checkout: refusing a
    // preview only costs the customer a nicer cart, not the sale.
    try {
      const { success } = await promoCodeLimiter.limit(
        `promo:${getClientIp(request.headers)}`,
      );
      if (!success) {
        return NextResponse.json(
          { error: "Too many code attempts. Please try again shortly." },
          { status: 429 },
        );
      }
    } catch (error) {
      console.error(
        `[promo] rate limiter unavailable, allowing preview: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }

    // Prices come from the database, never from the request. The cart lives in
    // the visitor's browser and can be edited freely, so a basket that claims
    // its pairs cost EUR 500 would otherwise make any discount look affordable.
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

    const evaluated = await evaluateDiscountForBasket({
      code,
      lines: items.map((item) => {
        const variant = byId.get(item.variantId)!;
        return {
          priceCents: variant.priceCents ?? variant.product.priceCents,
          supplierCostUsdCents: variant.product.supplierCostUsdCents,
          quantity: item.quantity,
        };
      }),
      currency,
      destinationCountry,
    });

    if (!evaluated.ok) {
      console.warn(`[promo] preview refused "${code}": ${evaluated.detail}`);
      return NextResponse.json({ error: evaluated.message }, { status: 400 });
    }

    return NextResponse.json({
      code: evaluated.code,
      discountCents: evaluated.discountCents,
    });
  } catch {
    return NextResponse.json({ error: "Could not check that code" }, { status: 500 });
  }
}
