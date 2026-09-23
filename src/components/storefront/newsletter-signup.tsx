"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * "STAY ON THE FREQUENCY", the footer signup (D4). Copy is the client's, as
 * written on 2026-09-21.
 *
 * ⚠️ The success message says "check your inbox", never "you're subscribed":
 * nobody is on the list until they click the link we mail them (double
 * opt-in, see `src/lib/newsletter.ts`). And it is shown for every accepted
 * request, including an address that was already on the list, because the
 * route answers them identically on purpose.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setError("Something went wrong. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="display text-2xl md:text-3xl text-brand-beige">
        STAY ON THE FREQUENCY
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-brand-beige/80">
        New drops, restocks, sounds and transmissions from ALLTERNATIV.
      </p>

      {state === "sent" ? (
        <p role="status" className="mt-6 text-sm leading-relaxed text-brand-beige">
          Check your inbox. We sent a link to confirm. Until you click it, this
          address is not on the list.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6" noValidate>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              maxLength={191}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              aria-invalid={state === "error"}
              aria-describedby={state === "error" ? "newsletter-error" : undefined}
              className="min-h-12 flex-1 rounded-full border border-white/20 bg-white/5 px-5 text-sm text-brand-beige placeholder:text-brand-beige/40 focus:border-brand-beige/60 focus:outline-none"
            />
            {/* Honeypot: hidden from people and from assistive technology,
                filled in by bots. The route answers a filled one like any
                other, so a bot learns nothing. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="absolute left-[-9999px] h-px w-px opacity-0"
            />
            <button
              type="submit"
              disabled={state === "sending" || email.trim() === ""}
              className="eyebrow min-h-12 rounded-full bg-brand-beige px-6 text-brand-ink fluid-transition hover:opacity-90 disabled:opacity-50"
            >
              {state === "sending" ? "Joining..." : "JOIN THE FREQUENCY"}
            </button>
          </div>
          {state === "error" && (
            <p id="newsletter-error" role="alert" className="mt-3 text-sm text-brand-rose">
              {error}
            </p>
          )}
        </form>
      )}

      <p className="mt-4 text-xs leading-relaxed text-brand-beige/50">
        We don&apos;t send emails to fill your inbox. We transmit when
        there&apos;s something worth tuning into. Unsubscribe from any email.{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-brand-beige">
          Privacy
        </Link>
      </p>
    </div>
  );
}
