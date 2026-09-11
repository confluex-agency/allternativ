"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Spends a verification link, on a button rather than on page load.
 *
 * See the note in the page: a link that is consumed by a GET is consumed by
 * every mail scanner and link preview that touches it, and the person then
 * arrives to be told their own link has already been used.
 */
export function AccountVerify({ token }: { token: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">(
    token ? "idle" : "failed",
  );
  const [error, setError] = useState(
    token ? "" : "That link is missing its token.",
  );

  async function confirm() {
    if (!token) return;
    setState("working");
    try {
      const res = await fetch("/api/account/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "That link did not work.");
        setState("failed");
        return;
      }
      setState("done");
      router.refresh();
    } catch {
      setError("Something went wrong.");
      setState("failed");
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-6 md:py-24 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-md">
        <p className="eyebrow text-brand-muted mb-5">confirm your email</p>

        {state === "done" ? (
          <>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
              Confirmed.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
              Your order history is open. Anything you bought with this address
              — including before you had an account — is there now.
            </p>
            {/* ⚠️ Confirming ends every session that existed before it, on
                purpose: if somebody else had registered with this address
                first, their sign-in dies here rather than inheriting a history
                this click just unlocked. So the next step really is to sign
                in, and saying so stops it reading as a bug. */}
            <p className="mt-3 text-sm leading-relaxed text-brand-muted">
              For safety this also signed out anything already using the
              account, so sign in once more below.
            </p>
            <Link
              href="/account/login"
              className="eyebrow mt-10 inline-block rounded-full bg-brand-ink px-6 py-4 text-brand-beige fluid-transition hover:opacity-90"
            >
              Sign in
            </Link>
          </>
        ) : state === "failed" ? (
          <>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
              That link is done.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
              {error}
            </p>
            <Link
              href="/account"
              className="eyebrow mt-10 inline-block rounded-full border border-brand-ink/20 px-6 py-4 text-brand-ink fluid-transition hover:bg-brand-ink/5"
            >
              Ask for a new one
            </Link>
          </>
        ) : (
          <>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
              One tap left.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
              Confirming tells us this address is yours, which is what opens
              your order history.
            </p>
            <button
              type="button"
              onClick={confirm}
              disabled={state === "working"}
              className="eyebrow mt-10 rounded-full bg-brand-ink px-6 py-4 text-brand-beige fluid-transition hover:opacity-90 disabled:opacity-50"
            >
              {state === "working" ? "Confirming..." : "Confirm this address"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
