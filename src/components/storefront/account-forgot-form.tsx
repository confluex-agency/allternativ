"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

/**
 * Ask for a reset link.
 *
 * ⚠️ **The screen after submitting says the same thing to everybody**, because
 * the route does. It does not say "we found your account" or "no account with
 * that address" — either sentence would hand an enumeration oracle to anybody
 * with a list of email addresses and a browser, and it would do it in the one
 * place the API was careful not to.
 *
 * That means the honest confirmation is slightly awkward to word: it has to
 * tell a real customer their link is coming without telling a stranger whether
 * it is. "If there is an account for that address" does both, and the sentence
 * about the inbox gives a person who typed a typo something useful to do.
 */
export function AccountForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/account/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Only the rate limiter can get here, and it is the same for everybody.
        setError(data.error || "Something went wrong");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-6 md:py-24 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-md">
        <p className="eyebrow text-brand-muted mb-5">password</p>

        {sent ? (
          <>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
              Check your email.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
              If there is an account for {email}, a link to choose a new
              password is on its way. It works once and expires in a few hours.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-brand-muted">
              Nothing has changed yet — your current password still works until
              you use that link. If it does not arrive within a few minutes,
              check the address for a typo and look in your spam folder.
            </p>
            <Link
              href="/account/login"
              className="eyebrow mt-10 inline-block rounded-full border border-brand-ink/20 px-6 py-4 text-brand-ink fluid-transition hover:bg-brand-ink/5"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
              Forgotten it?
            </h1>
            <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
              Tell us the address you use here and we will send a link to choose
              a new password.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6 md:mt-12">
              <label className="block">
                <span className="eyebrow text-brand-muted">Email</span>
                <input
                  type="email"
                  value={email}
                  required
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full border-0 border-b border-brand-ink/20 bg-transparent pb-2 text-base text-brand-ink outline-none fluid-transition focus:border-brand-ink"
                />
              </label>

              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="eyebrow w-full rounded-full bg-brand-ink px-6 py-4 text-brand-beige fluid-transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send me a link"}
              </button>
            </form>

            <p className="mt-8 text-sm text-brand-ink-soft">
              Remembered it?{" "}
              <Link
                href="/account/login"
                className="text-brand-ink underline underline-offset-4"
              >
                Sign in
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
