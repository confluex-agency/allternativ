"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";
import { pairsLeftInOrder } from "@/lib/shipping";

// Lines are keyed by `lineId` (variant + case colour). Adding the same variant
// with a different case adds a second line, which is what the customer expects
// and what the supplier needs in order to pack the right box.
//
// The bag never grows past MAX_PAIRS_PER_ORDER. Adds and increases beyond it
// are trimmed here rather than refused at checkout, so the limit is met while
// browsing. Decreases are never trimmed: a basket saved before the cap existed
// has to be able to shrink back under it.

const pairsIn = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.quantity, 0);

interface CartStore {
  items: CartItem[];
  /** False when the bag was already full and nothing was added. */
  addItem: (item: CartItem) => boolean;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalCents: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const room = pairsLeftInOrder(pairsIn(get().items));
        const quantity = Math.min(item.quantity, room);
        if (quantity <= 0) return false;
        set((state) => {
          const existing = state.items.find((i) => i.lineId === item.lineId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === item.lineId
                  ? { ...i, quantity: i.quantity + quantity }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        });
        return true;
      },

      removeItem: (lineId) =>
        set((state) => ({
          items: state.items.filter((i) => i.lineId !== lineId),
        })),

      updateQuantity: (lineId, quantity) =>
        set((state) => {
          if (quantity <= 0)
            return { items: state.items.filter((i) => i.lineId !== lineId) };
          const line = state.items.find((i) => i.lineId === lineId);
          if (!line) return state;
          // Only growth is capped, and only by the room the other lines leave.
          const ceiling =
            line.quantity + pairsLeftInOrder(pairsIn(state.items));
          const next =
            quantity > line.quantity ? Math.min(quantity, ceiling) : quantity;
          return {
            items: state.items.map((i) =>
              i.lineId === lineId ? { ...i, quantity: next } : i,
            ),
          };
        }),

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalCents: () =>
        get().items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    }),
    {
      name: "allternativ-cart",
      // Lines used to be keyed by product code, which the checkout could not
      // resolve. Anything saved under the old shape is dropped rather than
      // migrated: those baskets could never have been paid for anyway.
      version: 2,
      migrate: () => ({ items: [] as CartItem[] }),
    },
  ),
);
