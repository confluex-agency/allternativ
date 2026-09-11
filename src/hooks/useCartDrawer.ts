"use client";

import { create } from "zustand";

// Whether the basket panel is open. One flag, and deliberately NOT persisted.
//
// Everything else the shop keeps in the browser survives a reload on purpose —
// the basket, the wishlist, the chosen destination — because losing any of them
// loses work the visitor did. This is not that: a panel that reopened itself on
// every page load would be a thing to dismiss, not a thing to use. It is
// interface state, and interface state belongs to the session it happened in.
//
// Kept out of `useCart` so that opening the panel does not touch the store the
// basket persists from, and so nothing here can ever end up in localStorage by
// somebody adding a field to the wrong object.

interface CartDrawerStore {
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  setOpen: (open: boolean) => void;
}

export const useCartDrawer = create<CartDrawerStore>()((set) => ({
  open: false,
  openCart: () => set({ open: true }),
  closeCart: () => set({ open: false }),
  setOpen: (open) => set({ open }),
}));
