import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { stripe, SUPPORTED_CURRENCIES } from "@/lib/stripe";
import { env } from "@/lib/env";
import {
  CASE_COLORS,
  caseLabel,
  isCaseColor,
  type CaseColor,
} from "@/lib/product-options";
import {
  quoteShipping,
  DELIVERY_ESTIMATE_BUSINESS_DAYS,
  MAX_PAIRS_PER_ORDER,
} from "@/lib/shipping";
import { evaluateDiscountForBasket } from "@/lib/promotions";
import { encodeItemsMetadata } from "@/lib/checkout-metadata";
import { marketForCountry, MARKETS } from "@/lib/markets";
import { promoCodeLimiter, getClientIp } from "@/lib/rate-limit";
import type Stripe from "stripe";
import {
  reserveStock,
  releaseReservationGroup,
  attachSessionToReservations,
  OutOfStockError,
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
        // Still accepted, and ignored: a basket saved before 2026-09-24 carries
        // the case the shopper picked. What ships is the colourway's own case,
        // read from the database below like the price is.
        caseColor: z.enum(CASE_COLORS).optional(),
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
  // D4: the "Stay on the frequency" box in the cart, unticked by default.
  // Only `true` counts. It travels to the webhook as metadata and is
  // recorded there against the address the buyer actually paid with, which is
  // not known here: Stripe's page is where it is typed.
  newsletter: z.boolean().optional(),
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
    const {
      items: requested,
      currency,
      destinationCountry,
      promotionCode,
      newsletter,
    } = parsed.data;

    const pairs = requested.reduce((n, i) => n + i.quantity, 0);

    // C3, 2026-09-19: three pairs per order. The basket already stops there,
    // but it lives in localStorage and a basket saved before the cap still
    // holds more, so this is the check that counts. Before any stock is taken.
    if (pairs > MAX_PAIRS_PER_ORDER) {
      return NextResponse.json(
        {
          error: `Orders are limited to ${MAX_PAIRS_PER_ORDER} pairs. Please remove ${pairs - MAX_PAIRS_PER_ORDER} to continue.`,
        },
        { status: 400 },
      );
    }

    // Refuse a destination we have no quoted rate for rather than guessing one.
    // Shipping something at an invented price is worse than not selling it.
    const shipping = quoteShipping(destinationCountry, pairs, currency);
    if (!shipping) {
      return NextResponse.json(
        { error: "We do not ship to that country yet." },
        { status: 400 },
      );
    }

    const variantIds = [...new Set(requested.map((i) => i.variantId))];
    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        isActive: true,
        product: { status: "LIVE" },
      },
      include: { product: { include: { marketPrices: true } } },
    });

    if (variants.length !== variantIds.length) {
      return NextResponse.json(
        { error: "Some items are no longer available" },
        { status: 400 },
      );
    }

    const byId = new Map(variants.map((v) => [v.id, v]));

    // The case each colourway is packed in, never the one the basket names.
    // A colourway nobody has recorded a case for is not sold: guessing the box
    // is the mistake the fixed case replaced.
    const caseById = new Map<string, CaseColor>();
    for (const v of variants) {
      if (!isCaseColor(v.caseColor)) {
        return NextResponse.json(
          { error: "Some items are no longer available" },
          { status: 400 },
        );
      }
      caseById.set(v.id, v.caseColor);
    }
    // Two lines of one colourway (an old basket with both cases) become one.
    const quantities = new Map<string, number>();
    for (const i of requested) {
      quantities.set(i.variantId, (quantities.get(i.variantId) ?? 0) + i.quantity);
    }
    const items = [...quantities].map(([variantId, quantity]) => ({
      variantId,
      quantity,
      caseColor: caseById.get(variantId)!,
    }));

    // Take the stock now, before sending anyone to pay. Checking here and
    // decrementing after payment leaves minutes in which everyone is told the
    // last unit is theirs. See src/lib/inventory.ts.
    const reservationGroup = randomUUID();
    try {
      await reserveStock(
        items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          // No `caseKey`: the case is packed with the pair and counted with it.
        })),
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

    // ── What a pair costs, in the currency of where it is going ─────────────
    //
    // Read from the database, never from the request. The basket lives in the
    // visitor's browser and can be edited freely, so a cart claiming its pairs
    // cost twenty euros would otherwise be honoured.
    //
    // The market is derived from the destination country rather than sent
    // alongside it. Sending both would let a basket ask for the cheapest
    // market's price and the dearest market's delivery.
    const market = marketForCountry(destinationCountry);
    if (!market || MARKETS[market].currency !== currency) {
      // The currency has to be the one that destination is priced in. Anything
      // else is a basket that was tampered with, or a stale tab from before a
      // market changed, and neither should be charged.
      return NextResponse.json(
        { error: "That currency is not available for this destination." },
        { status: 400 },
      );
    }

    const unitPriceFor = (variantId: string): number => {
      const variant = byId.get(variantId)!;
      // A colourway that sets its own price keeps it; that is a per-variant
      // fact and the market table is a per-product one. None do today.
      if (variant.priceCents !== null) return variant.priceCents;
      const row = variant.product.marketPrices.find((p) => p.market === market);
      // Falling back to the euro price rather than refusing: a product created
      // in the admin before its six prices are set still has to be sellable,
      // and a missing row is a to-do rather than a broken checkout.
      return row?.priceCents ?? variant.product.priceCents;
    };

    const lineItems = items.map((item) => {
      const variant = byId.get(item.variantId)!;
      return {
        price_data: {
          currency,
          product_data: {
            name: `${variant.product.name} — ${variant.colorName}`,
            description: `Case: ${caseLabel(item.caseColor)}`,
          },
          unit_amount: unitPriceFor(item.variantId),
        },
        quantity: item.quantity,
      };
    });

    // ── The discount, and the floor under it ────────────────────────────────
    //
    // Checked with the basket in hand, and not as a rule about the code itself.
    // The same 70% code can be ruinous on two pairs to Malta and perfectly
    // healthy on four to Germany, because the parcel costs roughly the same
    // either way while the sale does not. A blanket cap on the coupon would
    // refuse both or allow both; only the basket knows.
    //
    // The arithmetic lives in src/lib/promotions.ts because the cart's Apply
    // button runs the very same call. What the browser previews and what this
    // decides can therefore never disagree. The preview is still advisory: no
    // number from the request is trusted here, it is all recomputed.
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

      const evaluated = await evaluateDiscountForBasket({
        code: promotionCode,
        lines: items.map((item) => {
          const variant = byId.get(item.variantId)!;
          return {
            priceCents: unitPriceFor(item.variantId),
            supplierCostUsdCents: variant.product.supplierCostUsdCents,
            quantity: item.quantity,
          };
        }),
        currency,
        destinationCountry,
      });

      if (!evaluated.ok) {
        await releaseReservationGroup(reservationGroup);
        console.warn(`[promo] refused "${promotionCode}": ${evaluated.detail}`);
        return NextResponse.json({ error: evaluated.message }, { status: 400 });
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
          // What the webhook needs to write the order lines. The case colour
          // still travels, frozen from the variant, though the webhook now
          // prefers the variant's own.
          //
          // Split across numbered keys by `encodeItemsMetadata`. Stripe caps a
          // metadata value at 500 characters, and this used to be one value: a
          // five-line cart came to 557 and Stripe refused the whole session, so
          // the shopper simply could not pay.
          ...encodeItemsMetadata(items),
          reservationGroup,
          // Absent unless ticked, so an old session or a forged payload
          // defaults to no consent. See `recordCheckoutConsent`.
          ...(newsletter === true ? { newsletter: "yes" } : {}),
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
