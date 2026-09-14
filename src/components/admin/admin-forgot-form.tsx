"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

/**
 * Ask for an admin reset link.
 *
 * ⚠️ The confirmation says the same thing to everybody, because the route does.
 * It must not say "we found your account" — on a STAFF login that would let
 * anybody enumerate who works here, which is where a targeted phish starts.
 */
export function AdminForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-md px-6">
      {sent ? (
        <>
          <h1 className="text-2xl font-semibold">Check your email.</h1>
          <p className="mt-3 text-sm text-neutral-600">
            If {email} has an admin account, a link to choose a new password is
            on its way. It works once and expires in about two hours.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Nothing has changed yet — your current password keeps working until
            you use that link.
          </p>
          <Link
            href="/admin/login"
            className="mt-8 inline-block text-sm underline"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Forgotten your password?</h1>
          <p className="mt-3 text-sm text-neutral-600">
            We will email you a link to choose a new one.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-neutral-500">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Sending..." : "Send me a link"}
            </button>
          </form>
          <Link
            href="/admin/login"
            className="mt-6 inline-block text-sm underline"
          >
            Back to sign in
          </Link>
        </>
      )}
    </div>
  );
}
