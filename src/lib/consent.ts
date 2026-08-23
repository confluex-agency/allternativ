"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Whether this visitor has agreed to be measured.
//
// ⚠️ THIS EXISTS BECAUSE THE SHOP WAS BREAKING THE LAW IT SELLS UNDER. Tracking
// began on the first page load: a 365-day `alt_vid` cookie, a session id, page
// views, and a hashed IP stored server-side, all before anybody was asked.
// Selling into the European Union, an analytics cookie needs consent BEFORE it
// is set, not a notice afterwards, and there was no notice either.
//
// ── What "essential" means here ────────────────────────────────────────────
// The basket, the wishlist and the chosen destination are kept whatever is
// decided, and they are not a loophole: all three exist only because the
// visitor asked for something (put this in my bag, send it to Spain) and none
// of them leaves the browser or identifies anyone. Refusing everything else
// costs a visitor nothing except our knowing they were here.
//
// The default is REFUSAL, not silence. Until somebody says yes, `granted` is
// false and nothing measures anything.

export type ConsentChoice = "all" | "essential";

interface ConsentStore {
  /** Null until the visitor answers. Null behaves exactly like "essential". */
  choice: ConsentChoice | null;
  setChoice: (choice: ConsentChoice) => void;
}

export const useConsent = create<ConsentStore>()(
  persist(
    (set) => ({
      choice: null,
      setChoice: (choice) => set({ choice }),
    }),
    { name: "allternativ:consent" },
  ),
);

/** True only after an explicit yes. Silence is a no. */
export function analyticsAllowed(): boolean {
  return useConsent.getState().choice === "all";
}
