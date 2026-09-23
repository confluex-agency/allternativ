"use client";

import { useState } from "react";
import Link from "next/link";

type Mode = "confirm" | "unsubscribe";

const COPY: Record<
  Mode,
  {
    eyebrow: string;
    idleTitle: string;
    idleBody: string;
    button: string;
    working: string;
    doneTitle: string;
    doneBody: string;
    failedTitle: string;
  }
> = {
  confirm: {
    eyebrow: "stay on the frequency",
    idleTitle: "One tap left.",
    idleBody:
      "Confirm and this address joins the list: new drops, restocks, sounds and transmissions from ALLTERNATIV.",
    button: "Join the frequency",
    working: "Joining...",
    doneTitle: "You're on the frequency.",
    doneBody:
      "We don't send emails to fill your inbox. We transmit when there's something worth tuning into.",
    failedTitle: "That link is done.",
  },
  unsubscribe: {
    eyebrow: "newsletter",
    idleTitle: "Leave the list?",
    idleBody:
      "You will stop receiving drops, restocks and transmissions. Emails about an order you placed are not affected.",
    button: "Unsubscribe",
    working: "Unsubscribing...",
    doneTitle: "You're off the list.",
    doneBody:
      "No more newsletters to this address. If you change your mind, you can join again from the bottom of any page.",
    failedTitle: "That link did not work.",
  },
};

/**
 * Spends a newsletter link on a button, never on page load: a mail scanner or
 * a link preview fetches the URL, and must not subscribe or unsubscribe
 * anybody by doing so. Same pattern as `AccountVerify`.
 */
export function NewsletterLinkAction({
  mode,
  token,
}: {
  mode: Mode;
  token: string | null;
}) {
  const copy = COPY[mode];
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">(
    token ? "idle" : "failed",
  );
  const [error, setError] = useState(
    token ? "" : "That link is missing part of its address.",
  );

  async function run() {
    if (!token) return;
    setState("working");
    try {
      const res = await fetch(`/api/newsletter/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.result === "expired"
            ? "It expired before it was used. Sign up again from the bottom of any page and we will send a fresh one."
            : "It may have been used already, or copied only in part.",
        );
        setState("failed");
        return;
      }
      setState("done");
    } catch {
      setError("Something went wrong. Please try again.");
      setState("failed");
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-6 md:py-24 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-md">
        <p className="eyebrow text-brand-muted mb-5">{copy.eyebrow}</p>

        {state === "done" ? (
          <>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
              {copy.doneTitle}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
              {copy.doneBody}
            </p>
            <Link
              href="/collections"
              className="eyebrow mt-10 inline-block rounded-full bg-brand-ink px-6 py-4 text-brand-beige fluid-transition hover:opacity-90"
            >
              Back to the shop
            </Link>
          </>
        ) : state === "failed" ? (
          <>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
              {copy.failedTitle}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
              {error}
            </p>
          </>
        ) : (
          <>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
              {copy.idleTitle}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
              {copy.idleBody}
            </p>
            <button
              type="button"
              onClick={run}
              disabled={state === "working"}
              className="eyebrow mt-10 rounded-full bg-brand-ink px-6 py-4 text-brand-beige fluid-transition hover:opacity-90 disabled:opacity-50"
            >
              {state === "working" ? copy.working : copy.button}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
