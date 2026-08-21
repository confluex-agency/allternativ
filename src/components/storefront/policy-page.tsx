import type { ReactNode } from "react";
import { legalDetailsComplete, COMPANY } from "@/lib/legal";

// The shell every policy page sits in.
//
// Deliberately plain next to the rest of the site. Somebody reading this page is
// looking for a fact, usually because something has gone wrong, and the holo
// gradients that make the storefront feel like the brand would be in the way.
// Wide measure, quiet type, headings you can scan.

export function PolicyPage({
  eyebrow,
  title,
  standfirst,
  children,
}: {
  eyebrow: string;
  title: string;
  standfirst: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-6 md:py-20 lg:px-12">
      <div className="max-w-2xl">
        <p className="eyebrow text-brand-ink-soft mb-5">{eyebrow}</p>
        <h1 className="display text-[clamp(2.25rem,7vw,4rem)] leading-[1.02] text-brand-ink">
          {title}
        </h1>
        <p className="mt-6 text-base text-brand-ink-soft md:text-lg">
          {standfirst}
        </p>

        {!legalDetailsComplete() && (
          <p
            role="note"
            className="mt-8 border-l-2 border-brand-ink/30 pl-4 text-sm text-brand-ink-soft"
          >
            <span className="eyebrow text-brand-ink">Not final yet</span>
            <br />
            Allternativ&rsquo;s company registration is being completed. The
            practical terms on this page are what we will operate by, but the
            page is not yet a final legal document. Questions in the meantime:{" "}
            <a
              href={`mailto:${COMPANY.contactEmail}`}
              className="underline underline-offset-2 hover:text-brand-ink"
            >
              {COMPANY.contactEmail}
            </a>
            .
          </p>
        )}

        <div className="mt-12 flex flex-col gap-10 md:mt-16">{children}</div>
      </div>
    </div>
  );
}

export function PolicySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-brand-ink/10 pt-6">
      <h2 className="text-lg font-medium text-brand-ink md:text-xl">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-brand-ink-soft md:text-base">
        {children}
      </div>
    </section>
  );
}
