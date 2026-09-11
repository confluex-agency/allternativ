"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Sign in and sign up, which are the same form with a different verb.
 *
 * Kept as one component because the two screens have to stay in step: the
 * password rules, the error placement and the wording about what an account
 * does are the sort of thing that drifts the moment there are two copies —
 * the same way `ProductCard` drifted when the home grid and the catalogue each
 * had their own.
 */
export function AccountAuthForm({
  mode,
  next,
}: {
  mode: "login" | "register";
  next: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const registering = mode === "register";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        registering ? "/api/account/register" : "/api/account/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            registering
              ? { email, password, name, marketingConsent: consent }
              : { email, password },
          ),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-6 md:py-24 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-md">
        <p className="eyebrow text-brand-muted mb-5">
          {registering ? "create an account" : "account"}
        </p>
        <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] text-brand-ink">
          {registering ? "Join us." : "Welcome back."}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-brand-ink-soft">
          {registering
            ? "An account keeps your orders and their tracking in one place. You never need one to buy."
            : "Sign in to see your orders and their tracking."}
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6 md:mt-12">
          {registering && (
            <Field
              label="Name"
              value={name}
              onChange={setName}
              autoComplete="name"
            />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={registering ? "new-password" : "current-password"}
            required
            hint={registering ? "At least 10 characters." : undefined}
          />

          {registering && (
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 size-4 accent-brand-ink"
              />
              {/* Off by default and stays off unless it is ticked. An account
                  is not consent (section 25). */}
              <span className="text-sm leading-relaxed text-brand-ink-soft">
                Send me occasional emails about new drops. Separate from order
                emails, which we send either way.
              </span>
            </label>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="eyebrow w-full rounded-full bg-brand-ink px-6 py-4 text-brand-beige fluid-transition hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? registering
                ? "Creating..."
                : "Signing in..."
              : registering
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="mt-8 text-sm text-brand-ink-soft">
          {registering ? (
            <>
              Already have one?{" "}
              <Link
                href="/account/login"
                className="text-brand-ink underline underline-offset-4"
              >
                Sign in
              </Link>
              .
            </>
          ) : (
            <>
              No account?{" "}
              <Link
                href="/account/register"
                className="text-brand-ink underline underline-offset-4"
              >
                Create one
              </Link>
              .
            </>
          )}
        </p>

        {/* ⚠️ Said out loud rather than left for somebody to discover: there is
            no "forgot password" yet, because it needs a mail provider and the
            shop does not have one. Promising a reset link that cannot be sent
            would be worse than admitting there is none. */}
        {!registering && (
          <p className="mt-3 text-xs leading-relaxed text-brand-muted">
            Forgotten your password? Write to us and we will sort it out — the
            self-service reset is not built yet.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow text-brand-muted">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full border-0 border-b border-brand-ink/20 bg-transparent pb-2 text-base text-brand-ink outline-none fluid-transition focus:border-brand-ink"
      />
      {hint && <span className="mt-1.5 block text-xs text-brand-muted">{hint}</span>}
    </label>
  );
}
