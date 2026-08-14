"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";

// Lines are keyed by `lineId` (variant + case colour). Adding the same variant
// with a different case adds a second line, which is what the customer expects
// and what the supplier needs in order to pack the right box.

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
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

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.lineId === item.lineId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === item.lineId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i,
              ),
            };
          }
          return { items: [...state.items, item] };
        }),

      removeItem: (lineId) =>
        set((state) => ({
          items: state.items.filter((i) => i.lineId !== lineId),
        })),

      updateQuantity: (lineId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.lineId !== lineId)
              : state.items.map((i) =>
                  i.lineId === lineId ? { ...i, quantity } : i,
                ),
        })),

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
