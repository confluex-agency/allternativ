"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

/**
 * Set a password against an emailed token — for a new invitation, or for a
 * reset on an account that already exists.
 *
 * ⚠️ One component for both, deliberately. The two screens ask for exactly the
 * same thing — a password, typed twice, against a token — and the password rule
 * is the part most likely to change. Two copies would be two places to change
 * it, and the second one is the one somebody forgets.
 *
 * What differs is the endpoint and the words, so those are the props.
 *
 * ⚠️ The token is spent by this POST, never by the page load — the same rule
 * the customer verify and reset pages follow, and it matters more here. A link
 * preview or a corporate mail scanner opening the URL would burn an invitation
 * that grants staff access, and the only way to recover is for an OWNER to
 * notice and send another.
 */
const COPY = {
  invite: {
    endpoint: "/api/admin-users/accept",
    heading: "Choose a password.",
    doneHeading: "You are set up.",
    intro:
      "This account can see orders, customers and prices, so the rule is stricter than the shop's:",
  },
  reset: {
    endpoint: "/api/auth/reset/confirm",
    heading: "Choose a new password.",
    doneHeading: "Password changed.",
    intro:
      "Same rule as before, and stricter than the shop's because this account can see orders, customers and prices:",
  },
} as const;

export function AcceptInviteForm({
  token,
  mode = "invite",
}: {
  token: string | null;
  mode?: "invite" | "reset";
}) {
  const copy = COPY[mode];
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState(
    token ? "" : "That link is missing its token.",
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    // Checked here because the server never sees the second field, and a
    // mistyped confirmation is not a security question — catching it before the
    // request also means a typo does not burn the one link.
    if (password !== confirm) {
      setError("Those two do not match.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const res = await fetch(copy.endpoint, {
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
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-md px-6">
      {done ? (
        <>
          <h1 className="text-2xl font-semibold">{copy.doneHeading}</h1>
          <p className="mt-3 text-sm text-neutral-600">
            Sign in with your email address and the password you just chose.
            {mode === "reset"
              ? " Anything that was already signed in to this account has been signed out."
              : ""}
          </p>
          <Link
            href="/admin/login"
            className="mt-8 inline-block rounded bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Sign in
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">{copy.heading}</h1>
          <p className="mt-3 text-sm text-neutral-600">
            {copy.intro} at least 12 characters, with an upper case letter, a
            lower case letter, a number and a symbol.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-neutral-500">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={!token}
                className="mt-1 w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-neutral-500">
                Again
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                disabled={!token}
                className="mt-1 w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !token}
              className="w-full rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Saving..." : "Set password"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
