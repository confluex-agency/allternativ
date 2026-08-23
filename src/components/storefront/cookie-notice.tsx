"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useConsent } from "@/lib/consent";
import { initTracking } from "@/lib/tracking";

// The consent notice.
//
// ── The two buttons weigh the same, and that is the point ──────────────────
// Refusing has to be as easy as accepting. A grey "manage preferences" link
// beside a large "accept all" button is the pattern regulators have repeatedly
// ruled invalid, and it would be a strange thing to build for a brand whose
// whole line is about not following the room. So: two buttons, same size, same
// shape, plain words, no dark pattern and no second screen to get through.
//
// It does not block the page. Nothing here needs consent to work: the shop
// sells, the basket fills and the checkout completes whatever is decided.
// Refusing costs the visitor nothing at all, which is what makes the choice a
// real one rather than a toll gate.
//
// Accepting calls `initTracking` immediately rather than waiting for the next
// navigation, so the session someone agreed to is the one they are having.

export function CookieNotice() {
  const setChoice = useConsent((s) => s.setChoice);

  // `useSyncExternalStore` with a server snapshot of "decided": the server
  // cannot know, and rendering the bar into the HTML would flash it at every
  // visitor who settled this months ago.
  const undecided = useSyncExternalStore(
    useConsent.subscribe,
    () => useConsent.getState().choice === null,
    () => false,
  );

  if (!undecided) return null;

  return (
    <div
      role="region"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-brand-ink/10 bg-brand-beige/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-12">
        <p className="max-w-2xl text-sm leading-relaxed text-brand-ink-soft">
          We&rsquo;d like to measure how the site is used, which means one
          cookie that recognises your browser on a return visit. Your basket and
          your delivery country are kept either way.{" "}
          <Link
            href="/cookies"
            className="underline underline-offset-2 hover:text-brand-ink"
          >
            What we store
          </Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => setChoice("essential")}
            className="h-11 flex-1 rounded-full border border-brand-ink/30 px-6 text-xs font-medium tracking-wide uppercase text-brand-ink fluid-transition hover:border-brand-ink md:flex-none"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={() => {
              setChoice("all");
              initTracking();
            }}
            className="h-11 flex-1 rounded-full border border-brand-ink bg-brand-ink px-6 text-xs font-medium tracking-wide uppercase text-brand-beige fluid-transition hover:opacity-90 md:flex-none"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
