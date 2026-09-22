import { Mail } from "lucide-react";
import { COMPANY } from "@/lib/legal";
import { ContactForm } from "@/components/storefront/contact-form";

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
// The address below is `COMPANY.contactEmail`, confirmed as info@ on
// 2026-09-22 (question D2 of the build plan). hola@ and support@ forward to it.
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

        <ContactForm contactEmail={CONTACT_EMAIL} />
      </div>
    </div>
  );
}
