// Stock, and why it cannot be oversold.
//
// The dangerous window is between checking that a unit exists and the customer
// actually paying for it: minutes, during which everyone else is told the same
// thing. This module closes it by taking the unit at the moment checkout starts.
//
// The guarantee itself is one SQL statement:
//
//     UPDATE product_variants SET stock_quantity = stock_quantity - n
//     WHERE id = ? AND stock_quantity >= n
//
// The database decides who wins. If it changed no rows, someone else got there
// first and we say so. No amount of concurrency can produce a negative stock,
// because the condition and the write are the same operation.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/** How long a checkout holds its stock. Matches the Stripe session lifetime. */
export const RESERVATION_MINUTES = 30;

export type ReservationRequest = {
  variantId: string;
  quantity: number;
};

export class OutOfStockError extends Error {
  constructor(public readonly variantId: string) {
    super("Not enough stock");
    this.name = "OutOfStockError";
  }
}

/**
 * Hands expired reservations back to stock.
 *
 * Called before every reservation attempt, so the system recovers on its own
 * even if the scheduled job never runs: an abandoned basket cannot lock a unit
 * forever. Safe to run concurrently — a reservation is only released once,
 * because the update is conditional on it still being unreleased.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const expired = await prisma.stockReservation.findMany({
    where: { releasedAt: null, expiresAt: { lt: new Date() } },
    select: { id: true, variantId: true, quantity: true },
  });
  if (expired.length === 0) return 0;

  let released = 0;
  for (const reservation of expired) {
    await prisma.$transaction(async (tx) => {
      // Conditional on still being open, so two concurrent runs cannot give the
      // same unit back twice.
      const claimed = await tx.stockReservation.updateMany({
        where: { id: reservation.id, releasedAt: null },
        data: { releasedAt: new Date(), consumed: false },
      });
      if (claimed.count === 0) return;

      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: { stockQuantity: { increment: reservation.quantity } },
      });
      released++;
    });
  }
  return released;
}

/**
 * Takes the stock for a checkout attempt and returns the group id that holds it.
 *
 * Throws OutOfStockError if any line cannot be satisfied. The whole basket is
 * refused rather than partially reserved: somebody who expects three pairs
 * should not end up paying for two.
 */
export async function reserveStock(
  items: ReservationRequest[],
  groupId: string,
): Promise<void> {
  await releaseExpiredReservations();

  const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60_000);

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      // The conditional decrement. `updateMany` gives us the row count, which
      // `update` does not, and the count is how we know whether we won.
      const taken = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          isActive: true,
          stockQuantity: { gte: item.quantity },
        },
        data: { stockQuantity: { decrement: item.quantity } },
      });

      if (taken.count === 0) {
        // Rolls back every line reserved so far in this transaction.
        throw new OutOfStockError(item.variantId);
      }

      await tx.stockReservation.create({
        data: {
          variantId: item.variantId,
          quantity: item.quantity,
          groupId,
          expiresAt,
        },
      });
    }
  });
}

/** Records which Stripe session ended up holding a reservation group. */
export async function attachSessionToReservations(
  groupId: string,
  stripeSessionId: string,
): Promise<void> {
  await prisma.stockReservation.updateMany({
    where: { groupId },
    data: { stripeSessionId },
  });
}

/**
 * Gives a group's stock back. Used when the Stripe session could not be
 * created, when it expires, and when a payment is cancelled.
 */
export async function releaseReservationGroup(groupId: string): Promise<void> {
  const open = await prisma.stockReservation.findMany({
    where: { groupId, releasedAt: null },
    select: { id: true, variantId: true, quantity: true },
  });

  for (const reservation of open) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.stockReservation.updateMany({
        where: { id: reservation.id, releasedAt: null },
        data: { releasedAt: new Date(), consumed: false },
      });
      if (claimed.count === 0) return;

      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: { stockQuantity: { increment: reservation.quantity } },
      });
    });
  }
}

/**
 * Turns a reservation group into a sale: the units are already out of stock, so
 * this only closes the reservations. Runs inside the order transaction, which is
 * why it takes the transaction client.
 *
 * Returns false when there was nothing open to consume, which means the
 * reservation had already expired and been handed back before the payment
 * landed. The caller decides what to do about it — the order is still recorded,
 * because the customer has genuinely paid.
 */
export async function consumeReservationGroup(
  tx: Prisma.TransactionClient,
  groupId: string,
): Promise<boolean> {
  const claimed = await tx.stockReservation.updateMany({
    where: { groupId, releasedAt: null },
    data: { releasedAt: new Date(), consumed: true },
  });
  return claimed.count > 0;
}

/**
 * Stock a shopper may actually buy right now. Reserved units are already out of
 * `stockQuantity`, so this is simply the column — the helper exists so callers
 * do not have to know that, and so the rule lives in one place.
 */
export function availableStock(variant: { stockQuantity: number }): number {
  return Math.max(0, variant.stockQuantity);
}
