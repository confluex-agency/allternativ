"use client";

import { useState, type FormEvent } from "react";
import {
  CONTACT_LIMITS,
  CONTACT_RETENTION_DAYS,
  CONTACT_TOPICS,
  CONTACT_TOPIC_KEYS,
} from "@/lib/contact-topics";

/**
 * The contact form, posting to `/api/contact`.
 *
 * ⚠️ "Received" is shown only after the server answers that the message is
 * stored. The form this replaced looked exactly like this one and sent nothing,
 * so the one promise it must never make again is a confirmation it cannot
 * back. On any failure the support address is shown instead, so a person who
 * wants to reach the shop always has a way that works.
 *
 * The limits in the inputs are a courtesy. The server checks every one of them
 * again, because a request does not have to come from this form.
 */
export function ContactForm({ contactEmail }: { contactEmail: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setStatus("sending");

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          topic: form.get("topic"),
          message: form.get("message"),
          website: form.get("website"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error ||
            `Your message could not be sent. Please write to ${contactEmail} instead.`,
        );
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError(
        `Your message could not be sent. Please write to ${contactEmail} instead.`,
      );
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="glass md:col-span-7 rounded-[1.5rem] p-6 md:rounded-[2rem] md:p-12"
      >
        <p className="eyebrow text-brand-muted mb-2">received</p>
        <h2 className="display mb-6 text-2xl text-brand-ink md:text-3xl">
          Thank you. It reached us.
        </h2>
        <p className="max-w-md text-base leading-relaxed text-brand-ink-soft">
          We read every message and answer from {contactEmail}. If you do not
          hear from us in a couple of days, look in your spam folder.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass md:col-span-7 rounded-[1.5rem] p-6 md:rounded-[2rem] md:p-12"
    >
      <p className="eyebrow text-brand-muted mb-2">form</p>
      <h2 className="display mb-8 text-2xl text-brand-ink md:mb-10 md:text-3xl">
        Tell us what&apos;s on your mind.
      </h2>

      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <Field
          label="Name"
          name="name"
          autoComplete="name"
          maxLength={CONTACT_LIMITS.name}
          required
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={CONTACT_LIMITS.email}
          required
        />
      </div>
      <div className="mt-5 md:mt-6">
        <label className="eyebrow mb-2 block text-brand-muted" htmlFor="topic">
          Subject
        </label>
        <select
          id="topic"
          name="topic"
          className="min-h-11 w-full rounded-xl border border-brand-ink/15 bg-white/70 px-4 py-3 text-base text-brand-ink focus:border-brand-ink focus:outline-none fluid-transition"
          defaultValue="GENERAL"
        >
          {CONTACT_TOPIC_KEYS.map((key) => (
            <option key={key} value={key}>
              {CONTACT_TOPICS[key]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-5 md:mt-6">
        <label className="eyebrow mb-2 block text-brand-muted" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          maxLength={CONTACT_LIMITS.message}
          placeholder="Write freely."
          className="w-full rounded-xl border border-brand-ink/15 bg-white/70 px-4 py-3 text-base text-brand-ink placeholder:text-brand-muted focus:border-brand-ink focus:outline-none fluid-transition resize-none"
        />
      </div>

      {/* The honeypot. Off-screen rather than `display: none`, which some bots
          know to skip, and out of the tab order and the accessibility tree so
          no person, sighted or not, ever reaches it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Leave this empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-8 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-ink px-7 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90 disabled:opacity-50 md:mt-10 md:w-auto"
      >
        {status === "sending" ? "Sending..." : "Send"}
      </button>
      <p className="mt-4 text-xs text-brand-muted">
        We use these details only to answer you, and delete the message from
        the site after {Math.round(CONTACT_RETENTION_DAYS / 30.4)} months.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="eyebrow mb-2 block text-brand-muted" htmlFor={name}>
        {label}
        {required && <span className="ml-1 text-brand-rose">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className="min-h-11 w-full rounded-xl border border-brand-ink/15 bg-white/70 px-4 py-3 text-base text-brand-ink placeholder:text-brand-muted focus:border-brand-ink focus:outline-none fluid-transition"
      />
    </div>
  );
}
