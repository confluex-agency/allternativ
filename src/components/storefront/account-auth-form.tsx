"use client";

import { useState, type FormEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Sign in and create an account: the same form with a different verb.
//
// ── Why it is one component, on two real URLs, that switches in place ───────
//
// The obvious version of this is a modal that toggles between the two, and it
// is what most shops do. It is worse here for a reason that has nothing to do
// with taste: **password managers.** 1Password, Chrome's own keychain and the
// rest key their autofill on a page, and they are markedly worse at offering a
// saved login — and at capturing a new one — inside a dialog that appears over
// something else. An account nobody can get back into is not an account.
//
// Real URLs also give us the back button, a link somebody can send, and the
// `?next=` that carries a visitor back to whatever they were doing before they
// were asked to sign in. A modal has none of those without reinventing them.
//
// But the video's instinct was not wrong about the switch itself. The version
// this replaced navigated between two pages, which meant somebody who typed
// their address, was told it did not match an account, and clicked "create
// one" **had to type it again**. That is the whole friction, and it is
// avoidable: the two modes live in one mounted component, so what has been
// typed survives the switch, and `window.history.replaceState` keeps the
// address bar honest without unmounting anything. Next supports that natively
// and syncs its own router with it.
//
// The switch is still a real `<Link>`, so a middle-click or a cmd-click opens
// the other form in its own tab exactly as a link should. Only the ordinary
// click is intercepted.

type Mode = "login" | "register";

const PATHS: Record<Mode, string> = {
  login: "/account/login",
  register: "/account/register",
};

export function AccountAuthForm({
  initialMode,
  next,
}: {
  initialMode: Mode;
  next: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);

  // Deliberately OUTSIDE the mode switch: these survive it, which is the
  // point. Nobody should have to retype their address to find out they needed
  // the other form.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const registering = mode === "register";
  const other: Mode = registering ? "login" : "register";

  function switchTo(target: Mode, event?: MouseEvent) {
    // Let the browser handle the clicks that mean "open this somewhere else".
    if (
      event &&
      (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
    ) {
      return;
    }
    event?.preventDefault();
    setMode(target);
    // The old form's complaint does not describe the new one.
    setError("");

    const query = next === "/account" ? "" : `?next=${encodeURIComponent(next)}`;
    window.history.replaceState(null, "", `${PATHS[target]}${query}`);
  }

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
            // ⚠️ This attribute is what tells a password manager whether to
            // offer a saved login or to capture a new one, so it has to follow
            // the mode rather than be set once.
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
          {registering ? "Already have one? " : "No account? "}
          <Link
            href={PATHS[other]}
            onClick={(e) => switchTo(other, e)}
            className="text-brand-ink underline underline-offset-4"
          >
            {registering ? "Sign in" : "Create one"}
          </Link>
          .
        </p>

        {/* This used to be a sentence admitting there was no reset, because a
            reset needs a mail provider and nothing had been observed leaving
            one. That was the right thing to say while it was true: promising a
            link that cannot be sent is worse than admitting there is none.

            It stopped being true on 2026-09-12, when a verification link left
            through Resend and was accepted, so the apology became a link. */}
        {!registering && (
          <p className="mt-3 text-sm text-brand-ink-soft">
            <Link
              href="/account/forgot"
              className="text-brand-ink underline underline-offset-4"
            >
              Forgotten your password?
            </Link>
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
