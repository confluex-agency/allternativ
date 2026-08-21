import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { stripe, SUPPORTED_CURRENCIES } from "@/lib/stripe";
import { env } from "@/lib/env";
import { CASE_COLORS, caseLabel, isCaseColor } from "@/lib/product-options";
import {
  quoteShipping,
  supplierCostUsdCents,
  usdCentsTo,
  DELIVERY_ESTIMATE_BUSINESS_DAYS,
} from "@/lib/shipping";
import { evaluatePromotionCode } from "@/lib/promotions";
import { promoCodeLimiter, getClientIp } from "@/lib/rate-limit";
import {
  estimatePaymentFeeCents,
  goodsCostCentsFor,
  netCents,
  MINIMUM_NET_CENTS,
} from "@/lib/margin";
import type Stripe from "stripe";
import {
  reserveStock,
  releaseReservationGroup,
  attachSessionToReservations,
  OutOfStockError,
  OutOfCasesError,
  CHECKOUT_WINDOW_MINUTES,
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
  // Where it is going, chosen in the cart BEFORE we get here.
  //
  // ⚠️ It has to be known now, not later, and that is a hard constraint rather
  // than a preference. Stripe's own documentation is explicit: "The hosted page
  // integration in Stripe Checkout does not support dynamically customizing
  // shipping options." We redirect to the hosted page, so the address the
  // customer types on Stripe's side cannot change the delivery price. The
  // country therefore comes from us, and `allowed_countries` below is pinned to
  // it so the two can never disagree.
  destinationCountry: z.string().length(2).toUpperCase(),
  // Typed in our cart, not on Stripe's page. See src/lib/promotions.ts for why
  // it had to move: a discount applied on the hosted page cannot be refused,
  // only regretted.
  promotionCode: z.string().trim().max(64).optional(),
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
    const { items, currency, destinationCountry, promotionCode } = parsed.data;

    // Refuse a destination we have no quoted rate for rather than guessing one.
    // Shipping something at an invented price is worse than not selling it.
    const pairs = items.reduce((n, i) => n + i.quantity, 0);
    const shipping = quoteShipping(destinationCountry, pairs, currency);
    if (!shipping) {
      return NextResponse.json(
        { error: "We do not ship to that country yet." },
        { status: 400 },
      );
    }

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
        items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          // One case per pair, out of its own pool.
          caseKey: i.caseColor,
        })),
        reservationGroup,
      );
    } catch (error) {
      if (error instanceof OutOfCasesError) {
        // Worth its own message: the eyewear is there, the case is not, and the
        // shopper only has to change one choice to carry on.
        return NextResponse.json(
          {
            error: isCaseColor(error.caseKey)
              ? `We have run out of ${caseLabel(error.caseKey)} cases. Please choose the other colour.`
              : "That case colour has just run out. Please choose another.",
          },
          { status: 409 },
        );
      }
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

    // ── The discount, and the floor under it ────────────────────────────────
    //
    // Checked here, with the basket in hand, and not as a rule about the code
    // itself. The same 70% code can be ruinous on two pairs to Malta and
    // perfectly healthy on four to Germany, because the parcel costs roughly
    // the same either way while the sale does not. A blanket cap on the coupon
    // would refuse both or allow both; only the basket knows.
    let discount: { id: string; code: string; cents: number } | null = null;

    if (promotionCode) {
      // The code field is an oracle by construction: type a string, learn
      // whether it is a live promotion. Validating before the money moves is
      // worth that, but not at unlimited speed.
      //
      // Fails OPEN on purpose. If the limiter itself is unreachable the shop
      // keeps selling: a rate limiter that can take the checkout down with it
      // is a worse problem than the one it guards against, and the codes still
      // have to be real Stripe promotions either way.
      try {
        const { success } = await promoCodeLimiter.limit(
          `promo:${getClientIp(request.headers)}`,
        );
        if (!success) {
          await releaseReservationGroup(reservationGroup);
          return NextResponse.json(
            { error: "Too many code attempts. Please try again shortly." },
            { status: 429 },
          );
        }
      } catch (error) {
        console.error(
          `[promo] rate limiter unavailable, allowing attempt: ${
            error instanceof Error ? error.message : "unknown"
          }`,
        );
      }

      const subtotalCents = items.reduce((sum, item) => {
        const variant = byId.get(item.variantId)!;
        return (
          sum +
          (variant.priceCents ?? variant.product.priceCents) * item.quantity
        );
      }, 0);

      const evaluated = await evaluatePromotionCode(
        promotionCode,
        subtotalCents,
        currency,
      );

      if (!evaluated.ok) {
        await releaseReservationGroup(reservationGroup);
        console.warn(`[promo] refused "${promotionCode}": ${evaluated.detail}`);
        return NextResponse.json({ error: evaluated.message }, { status: 400 });
      }

      const revenueCents =
        subtotalCents - evaluated.discountCents + shipping.amountCents;
      const economics = {
        revenueCents,
        goodsCostCents: goodsCostCentsFor(
          items.map((item) => ({
            supplierCostUsdCents:
              byId.get(item.variantId)!.product.supplierCostUsdCents,
            quantity: item.quantity,
          })),
          currency,
        ),
        // What the parcel costs to send, not what we charged for it. From two
        // pairs up those two numbers are as far apart as they get: the customer
        // pays nothing and the whole thing comes out of the margin.
        shippingCostCents:
          usdCentsTo(supplierCostUsdCents(destinationCountry, pairs), currency) ??
          0,
        paymentFeeCents: estimatePaymentFeeCents(revenueCents, currency),
      };
      const net = netCents(economics);

      if (net < MINIMUM_NET_CENTS) {
        await releaseReservationGroup(reservationGroup);
        // Loud, and naming the code: a code that can sink an order is a
        // dashboard mistake somebody has to go and fix, not a customer error.
        console.error(
          `[margin] REFUSED at checkout. Code "${evaluated.code}" on ${pairs} ` +
            `pair(s) to ${destinationCountry} would net ${net} ${currency.toUpperCase()}: ` +
            `revenue ${economics.revenueCents}, goods ${economics.goodsCostCents}, ` +
            `shipping ${economics.shippingCostCents}, fee ~${economics.paymentFeeCents}` +
            (shipping.free ? ". Delivery absorbed." : ""),
        );
        return NextResponse.json(
          { error: "That code is not valid for this order." },
          { status: 400 },
        );
      }

      discount = {
        id: evaluated.promotionCodeId,
        code: evaluated.code,
        cents: evaluated.discountCents,
      };
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        // The payment page closes before the reservation does, on purpose: see
        // RESERVATION_GRACE_MINUTES. An abandoned checkout still frees its stock
        // straight away, because Stripe sends `checkout.session.expired`.
        expires_at:
          Math.floor(Date.now() / 1000) + CHECKOUT_WINDOW_MINUTES * 60,
        // Without an address and a phone number the supplier cannot dispatch, and
        // the export file reaches them with no recipient.
        //
        // Pinned to the one country the delivery price was quoted for. Offering
        // the full list here would let someone pick Spain in the cart, pay the
        // Spanish rate, and then have it sent to Malta for four euros more.
        shipping_address_collection: {
          allowed_countries: [
            destinationCountry as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry,
          ],
        },
        // The delivery line the client asked to be shown separately. Zero is
        // still sent when it is free, so the customer sees "Free" spelled out
        // rather than no line at all.
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: shipping.free
                ? "Free shipping — tracked"
                : "Tracked shipping",
              fixed_amount: {
                amount: shipping.amountCents,
                currency,
              },
              delivery_estimate: {
                minimum: {
                  unit: "business_day",
                  value: DELIVERY_ESTIMATE_BUSINESS_DAYS.minimum,
                },
                maximum: {
                  unit: "business_day",
                  value: DELIVERY_ESTIMATE_BUSINESS_DAYS.maximum,
                },
              },
            },
          },
        ],
        phone_number_collection: { enabled: true },
        // ⚠️ `allow_promotion_codes` is deliberately absent. It used to be
        // true, which put the coupon field on Stripe's hosted page, where a
        // code is applied to a session that already exists and can therefore
        // only be observed, never refused. The field lives in our cart now and
        // the code arrives here already checked against the floor, so what
        // Stripe receives is a decision rather than an invitation. Stripe also
        // rejects a session that has both.
        //
        // The team still creates the codes in the dashboard, with no deploy.
        ...(discount
          ? { discounts: [{ promotion_code: discount.id }] }
          : {}),
        success_url: `${env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.NEXT_PUBLIC_APP_URL}/cart`,
        metadata: {
          // What the webhook needs to write the order lines, including the case
          // colour, which is not a variant and cannot be recovered from the SKU.
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
