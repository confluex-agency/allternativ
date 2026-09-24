"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SignedInCustomer } from "@/lib/customer-auth";

export interface AccountOrderView {
  orderNumber: string;
  placedAt: string;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  total: string;
  items: { label: string; caseColor: string | null; quantity: number }[];
}

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function AccountView({
  customer,
  orders,
}: {
  customer: SignedInCustomer;
  /** Null means the address is not proved yet, not "no orders". */
  orders: AccountOrderView[] | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(customer.name ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [consent, setConsent] = useState(customer.marketingConsent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resent, setResent] = useState<null | boolean>(null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Only what this person is allowed to change. Before the address is
        // proved that is consent and nothing else, so the identity fields are
        // left out of the body rather than sent and refused — the route
        // answers 403 to a body that carries them.
        body: JSON.stringify(
          customer.emailVerified
            ? { name, phone, marketingConsent: consent }
            : { marketingConsent: consent },
        ),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function resendVerification() {
    setResent(null);
    const res = await fetch("/api/account/verify/resend", { method: "POST" });
    const data = await res.json().catch(() => ({ queued: false }));
    setResent(res.ok && data.queued === true);
  }

  async function signOut() {
    await fetch("/api/account/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-6 md:py-24 lg:px-12 lg:py-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-brand-muted mb-5">account</p>
          <h1 className="display text-[clamp(2.5rem,8vw,4.5rem)] text-brand-ink">
            {customer.name?.split(" ")[0] ?? "Hello"}.
          </h1>
          <p className="mt-4 text-base text-brand-ink-soft">{customer.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="eyebrow text-brand-muted underline underline-offset-4 fluid-transition hover:text-brand-ink"
        >
          Sign out
        </button>
      </div>

      {!customer.emailVerified && (
        <div className="glass mt-10 rounded-[1.5rem] p-6 md:mt-12 md:rounded-[2rem] md:p-8">
          <p className="eyebrow text-brand-muted mb-2">confirm your email</p>
          <p className="max-w-2xl text-base leading-relaxed text-brand-ink-soft">
            Your order history — and your saved name and phone — stay closed
            until you click the link we send to{" "}
            <span className="text-brand-ink">{customer.email}</span>. We do not
            show what somebody bought, where it was sent, or who they are, to an
            address nobody has proved they own. That applies to this screen
            whoever is looking at it, which is the point.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={resendVerification}
              className="eyebrow rounded-full border border-brand-ink/20 px-5 py-2.5 text-brand-ink fluid-transition hover:bg-brand-ink/5"
            >
              Send it again
            </button>
            {resent === true && (
              <span className="text-sm text-brand-ink-soft">
                Queued. It goes out with the next sweep.
              </span>
            )}
            {resent === false && (
              <span className="text-sm text-brand-ink-soft">
                Nothing to send — this address is already confirmed.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-12 grid gap-12 md:mt-16 md:grid-cols-12 md:gap-16">
        {/* ── Orders ────────────────────────────────────────────────────── */}
        <section className="md:col-span-7">
          <h2 className="display mb-8 text-2xl text-brand-ink md:text-3xl">
            Orders
          </h2>

          {orders === null ? (
            <p className="max-w-md text-base leading-relaxed text-brand-ink-soft">
              Hidden until your email is confirmed. Nothing is lost — every
              order you have placed is still attached to this address and will
              appear here the moment you click the link.
            </p>
          ) : orders.length === 0 ? (
            <p className="max-w-md text-base leading-relaxed text-brand-ink-soft">
              Nothing here yet.
            </p>
          ) : (
            <ul className="space-y-6">
              {orders.map((order) => (
                <li
                  key={order.orderNumber}
                  className="glass rounded-[1.25rem] p-5 md:rounded-[1.5rem] md:p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="eyebrow text-brand-ink">
                      {order.orderNumber}
                    </span>
                    <span className="eyebrow text-brand-muted">
                      {order.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-brand-muted">
                    {DATE.format(new Date(order.placedAt))}
                  </p>

                  <ul className="mt-4 space-y-1.5">
                    {order.items.map((item, index) => (
                      <li
                        key={`${order.orderNumber}-${index}`}
                        className="text-sm text-brand-ink-soft"
                      >
                        {item.quantity} × {item.label}
                        {/* The case never appears in the name, so it has to
                            be said out loud. */}
                        {item.caseColor && (
                          <span className="text-brand-muted">
                            {" "}
                            (case: {item.caseColor.toLowerCase()})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-brand-ink/10 pt-4">
                    <span className="text-sm text-brand-ink">{order.total}</span>
                    {order.trackingNumber && (
                      <span className="text-sm text-brand-muted">
                        {order.carrier ? `${order.carrier} · ` : ""}
                        {order.trackingNumber}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Details ───────────────────────────────────────────────────── */}
        <section className="md:col-span-5">
          <h2 className="display mb-8 text-2xl text-brand-ink md:text-3xl">
            Details
          </h2>
          {!customer.emailVerified && (
            <p className="mb-6 max-w-md text-sm leading-relaxed text-brand-muted">
              Your name and phone are hidden, and cannot be changed, until the
              address above is confirmed.
            </p>
          )}
          <form onSubmit={saveProfile} className="space-y-5">
            <Field
              label="Name"
              value={name}
              onChange={setName}
              autoComplete="name"
              disabled={!customer.emailVerified}
            />
            <Field
              label="Phone"
              value={phone}
              onChange={setPhone}
              type="tel"
              autoComplete="tel"
              disabled={!customer.emailVerified}
            />

            {/* ⚠️ Not editable, and not an oversight. The address is the key
                the Stripe webhook matches orders on: changing it here would
                either hand this account somebody else's history or lose its
                own. */}
            <div>
              <span className="eyebrow text-brand-muted">Email</span>
              <p className="mt-1.5 text-base text-brand-ink">{customer.email}</p>
              <p className="mt-1 text-xs text-brand-muted">
                Write to us to change this — it is what your orders are filed
                under.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 pt-1">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 size-4 accent-brand-ink"
              />
              <span className="text-sm leading-relaxed text-brand-ink-soft">
                Send me occasional emails about new drops. Separate from order
                emails, which we send either way.
              </span>
            </label>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="eyebrow rounded-full bg-brand-ink px-6 py-3 text-brand-beige fluid-transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {saved && (
                <span className="text-sm text-brand-muted">Saved.</span>
              )}
            </div>
          </form>
        </section>
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow text-brand-muted">{label}</span>
      {/* Disabled is the courtesy, not the control: the server refuses the
          write regardless. A form that looks editable and silently discards
          what was typed is worse than one that says it is closed. */}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full border-0 border-b border-brand-ink/20 bg-transparent pb-2 text-base text-brand-ink outline-none fluid-transition focus:border-brand-ink disabled:opacity-40"
      />
    </label>
  );
}
