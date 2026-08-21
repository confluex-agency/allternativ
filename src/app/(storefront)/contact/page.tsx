import { Mail } from "lucide-react";
import { COMPANY } from "@/lib/legal";

const CONTACT_EMAIL = COMPANY.contactEmail;

export const metadata = {
  title: "Contact",
  description:
    "Write to us. Collaborations, special orders, distribution or conversations about frequency.",
};

// ⚠️ Two entries were removed from this list on 2026-08-21, and they are worth
// naming so nobody puts them back by accident.
//
// "Studio — Buenos Aires, visits by appointment" was invented. Allternativ is
// not registered as a company anywhere yet; that is item 1 of the client's own
// pending list. An address on a contact page is not decoration, it is an
// invitation to turn up somewhere, and there is nowhere to turn up to. It is
// the same class of claim as the "Handcrafted · LATAM" line that came off the
// product pages in August, on goods made in Yiwu and Shenzhen.
//
// "Instagram — @allternativ" linked to "#". Printing a handle asserts that the
// account exists, and an icon that does nothing when clicked reads as a brand
// that abandoned its accounts. Send the real handles and it comes back.
//
// The address below is the one already published on this page. It is not
// confirmed either — it is question D2 of the build plan — but it is what the
// site has always said, and inventing a SECOND unconfirmed address would be
// worse than keeping one.
const CHANNELS = [
  {
    icon: Mail,
    label: "Mail",
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-6 md:py-24 lg:px-12 lg:py-40">
      <div className="grid gap-12 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-5">
          <p className="eyebrow text-brand-muted mb-5">contact</p>
          <h1 className="display text-[clamp(2.5rem,8vw,5rem)] text-brand-ink">
            Write to us.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-brand-ink-soft md:mt-8">
            Collaborations, special orders, distribution or conversations about
            frequency and sunsets. We read every message.
          </p>

          <ul className="mt-10 space-y-5 md:mt-12 md:space-y-6">
            {CHANNELS.map(({ icon: Icon, label, value, href }) => (
              <li key={label} className="flex items-start gap-4">
                <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-full bg-brand-rose">
                  <Icon size={16} className="text-brand-ink" />
                </span>
                <div className="min-w-0">
                  <p className="eyebrow text-brand-muted">{label}</p>
                  {href ? (
                    <a
                      href={href}
                      className="mt-1 block break-words text-base text-brand-ink fluid-transition hover:text-brand-ink-soft"
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="mt-1 break-words text-base text-brand-ink">
                      {value}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <form className="glass md:col-span-7 rounded-[1.5rem] p-6 md:rounded-[2rem] md:p-12">
          <p className="eyebrow text-brand-muted mb-2">form</p>
          <h2 className="display mb-8 text-2xl text-brand-ink md:mb-10 md:text-3xl">
            Tell us what&apos;s on your mind.
          </h2>

          <div className="grid gap-5 md:grid-cols-2 md:gap-6">
            <Field label="Name" name="name" required />
            <Field label="Email" name="email" type="email" required />
          </div>
          <div className="mt-5 md:mt-6">
            <label
              className="eyebrow mb-2 block text-brand-muted"
              htmlFor="topic"
            >
              Subject
            </label>
            <select
              id="topic"
              name="topic"
              className="min-h-11 w-full rounded-xl border border-brand-ink/15 bg-white/70 px-4 py-3 text-base text-brand-ink focus:border-brand-ink focus:outline-none fluid-transition"
              defaultValue="general"
            >
              <option value="general">General enquiry</option>
              <option value="custom">Special order</option>
              <option value="press">Press / collaboration</option>
              <option value="stockist">Distribution / stockist</option>
            </select>
          </div>
          <div className="mt-5 md:mt-6">
            <label
              className="eyebrow mb-2 block text-brand-muted"
              htmlFor="message"
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={5}
              required
              placeholder="Write freely."
              className="w-full rounded-xl border border-brand-ink/15 bg-white/70 px-4 py-3 text-base text-brand-ink placeholder:text-brand-muted focus:border-brand-ink focus:outline-none fluid-transition resize-none"
            />
          </div>
          <button
            type="submit"
            className="mt-8 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-ink px-7 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90 md:mt-10 md:w-auto"
          >
            Send
          </button>
          <p className="mt-4 text-xs text-brand-muted">
            Mock preview — wired to Formspree once the endpoint is confirmed.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
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
        className="min-h-11 w-full rounded-xl border border-brand-ink/15 bg-white/70 px-4 py-3 text-base text-brand-ink placeholder:text-brand-muted focus:border-brand-ink focus:outline-none fluid-transition"
      />
    </div>
  );
}
