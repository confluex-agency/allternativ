"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

/**
 * Choose a new password, spending the link that got here.
 *
 * ⚠️ The token is spent by this POST, never by the page load — the same rule
 * the verification page follows and for the same reason: a GET is what a link
 * preview, a corporate mail scanner and a browser prefetch all issue, and any
 * of them would burn the link before the person clicked it. Here it would be
 * worse than on the verify page, because there is no way to re-issue a reset
 * except by asking for another one.
 *
 * ⚠️ It does not sign anybody in afterwards. The reset killed every session on
 * the account, which is the point of it, so the honest next step is the login
 * form — and saying so stops it reading as a failure.
 */
export function AccountResetForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState(
    token ? "" : "That link is missing its token.",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    // Checked here and not on the server: the server never sees the second
    // field, and a mistyped confirmation is not a security question. Catching
    // it before the request also means a typo does not burn the one link.
    if (password !== confirm) {
      setError("Those two do not match.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/account/password/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "That link did not work.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-6 md:py-24 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-md">
        <p className="eyebrow text-brand-muted mb-5">new password</p>

        {done ? (
          <>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
              Done.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
              Your new password is set. Sign in with it below.
            </p>
            {/* The same consequence the verify page explains, and it matters
                more here: if somebody else had been using this account, this is
                the moment they stopped. */}
            <p className="mt-3 text-sm leading-relaxed text-brand-muted">
              For safety this signed out anything already using the account,
              anywhere. Your order history is open once you sign in.
            </p>
            <Link
              href="/account/login"
              className="eyebrow mt-10 inline-block rounded-full bg-brand-ink px-6 py-4 text-brand-beige fluid-transition hover:opacity-90"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
              Choose a new one.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
              At least 10 characters. Length is what makes a password hard to
              guess, so a phrase you will remember beats a short one you will
              not.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6 md:mt-12">
              <label className="block">
                <span className="eyebrow text-brand-muted">New password</span>
                <input
                  type="password"
                  value={password}
                  required
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!token}
                  className="mt-1.5 w-full border-0 border-b border-brand-ink/20 bg-transparent pb-2 text-base text-brand-ink outline-none fluid-transition focus:border-brand-ink disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="eyebrow text-brand-muted">Again</span>
                <input
                  type="password"
                  value={confirm}
                  required
                  autoComplete="new-password"
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={!token}
                  className="mt-1.5 w-full border-0 border-b border-brand-ink/20 bg-transparent pb-2 text-base text-brand-ink outline-none fluid-transition focus:border-brand-ink disabled:opacity-50"
                />
              </label>

              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="eyebrow w-full rounded-full bg-brand-ink px-6 py-4 text-brand-beige fluid-transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Set new password"}
              </button>
            </form>

            <p className="mt-8 text-sm text-brand-ink-soft">
              Link expired?{" "}
              <Link
                href="/account/forgot"
                className="text-brand-ink underline underline-offset-4"
              >
                Ask for another
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
