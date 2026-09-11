// What an admin is allowed to change about an order, and what they are not.
//
// Kept out of the route for the same reason `customer-accounts.ts` is: the
// rules below are the whole point and they need to be testable without a
// server.
//
// ── The rule that shapes everything here ────────────────────────────────────
//
// ⚠️ **SHIPPED is not a status somebody picks. It is what a tracking number
// means.**
//
// Both existing doors to the supplier already work that way and write the two
// together. `/api/erp/tracking` sets `trackingNumber`, `carrier`, `shippedAt`
// and SHIPPED in one `updateMany` from the sheet Dianxiaomi exports. The
// WooCommerce façade at `/wp-json/wc/v3/orders/:id` goes further and forces it:
// if a tracking number arrives and `shippedAt` is null it sets SHIPPED
// whatever status the caller sent, because a tracking number means the parcel
// left the warehouse and the status field is an opinion.
//
// The dispatch email depends on that pairing — the sweep asks for SHIPPED
// **and** a tracking number. So a plain status dropdown offering SHIPPED would
// produce an order marked shipped with nothing to track, which the sweep then
// skips for ever while the buyer hears nothing. No error, no failed row,
// nobody looking. That is the worst failure shape this system has, and it is
// why the dropdown below cannot reach SHIPPED at all: dispatching by hand is a
// different operation that takes the tracking number with it.

import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/generated/prisma/enums";
import type { ManualStatus } from "@/lib/order-status";

// The list itself lives in `order-status.ts`, which imports nothing, because
// the client component that renders the buttons needs it and this module
// imports Prisma. Re-exported here so server callers read it beside the
// functions that enforce it. See the note over there for why each status is
// on the list or off it.
export { MANUAL_STATUSES, type ManualStatus } from "@/lib/order-status";

/** Statuses an order can still be dispatched from. */
const DISPATCHABLE = ["PAID", "PROCESSING"] as const;

export type OrderChangeResult =
  | { ok: true; from: OrderStatus; to: OrderStatus }
  | { ok: false; reason: "not-found" | "not-dispatchable" | "already-shipped" };

/**
 * Move an order to a status a person is allowed to set.
 *
 * ⚠️ Deliberately does NOT restore stock on CANCELLED, and does not refund.
 * Both of those are separate acts with their own consequences: the units were
 * taken when the checkout opened and putting them back is an inventory
 * decision, while the money is in Stripe and only Stripe can return it. This
 * records what was decided. The screen says so, so nobody assumes otherwise.
 */
export async function setManualStatus(
  orderId: string,
  status: ManualStatus,
): Promise<OrderChangeResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, orderNumber: true },
  });
  if (!order) return { ok: false, reason: "not-found" };

  // An order that has already gone is not a thing to re-open from here. The
  // parcel is with a courier; changing the word on our side changes nothing
  // about that, and would un-tell a story the buyer has already been told.
  if (order.status === "SHIPPED" || order.status === "DELIVERED") {
    return { ok: false, reason: "already-shipped" };
  }

  await prisma.order.update({ where: { id: order.id }, data: { status } });
  return { ok: true, from: order.status, to: status };
}

export type DispatchResult =
  | { ok: true; orderNumber: string; trackingNumber: string }
  | { ok: false; reason: "not-found" | "not-dispatchable" };

/**
 * Mark an order dispatched BY HAND, which means with its tracking number.
 *
 * This exists for the parcel that goes out some other way than Dianxiaomi —
 * it will happen, and without this the only honest options are to leave the
 * order looking unshipped for ever or to lie about the status.
 *
 * It writes exactly what `/api/erp/tracking` writes, in one update, so the two
 * doors cannot drift into two different notions of "shipped". Once both the
 * status and the number are there the sweep will send the dispatch email,
 * which is the whole reason the number is mandatory.
 */
export async function dispatchByHand(
  orderId: string,
  input: { trackingNumber: string; carrier: string | null },
): Promise<DispatchResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, orderNumber: true },
  });
  if (!order) return { ok: false, reason: "not-found" };
  if (!(DISPATCHABLE as readonly string[]).includes(order.status)) {
    return { ok: false, reason: "not-dispatchable" };
  }

  const trackingNumber = input.trackingNumber.trim();
  // The caller validates too; this is the invariant restated where it is
  // written, because everything downstream assumes it.
  if (!trackingNumber) return { ok: false, reason: "not-dispatchable" };

  await prisma.order.update({
    where: { id: order.id },
    data: {
      trackingNumber,
      carrier: input.carrier?.trim() || null,
      shippedAt: new Date(),
      status: "SHIPPED",
    },
  });

  return { ok: true, orderNumber: order.orderNumber, trackingNumber };
}
