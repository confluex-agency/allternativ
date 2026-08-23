import {
  PolicyPage,
  PolicySection,
} from "@/components/storefront/policy-page";
import { COMPANY } from "@/lib/legal";

export const metadata = {
  title: "Cookies",
  description:
    "Everything this site stores in your browser, what each thing is for, and how long it lasts.",
};

// Written from the code, not from a template. Every row below was found by
// reading what actually calls the browser's storage:
//
//   alt_vid                   src/lib/tracking.ts
//   alt_sid                   src/lib/tracking.ts (sessionStorage)
//   allternativ-cart          src/hooks/useCart.ts
//   allternativ-wishlist      src/hooks/useWishlist.ts
//   allternativ:destination   src/hooks/useDestination.ts
//   allternativ:consent       src/lib/consent.ts
//   allternativ-admin-token   src/lib/auth.ts (staff only, never a customer)
//
// ⚠️ If a new one is added anywhere, it belongs in this table on the same day.
// A cookie policy that has fallen behind the code is worse than none, because
// it is a written statement that happens to be false.

const ROWS = [
  {
    name: "allternativ-cart",
    kind: "Local storage",
    purpose: "The items in your basket, so they survive closing the tab.",
    life: "Until you clear it or empty the basket",
    essential: true,
  },
  {
    name: "allternativ:destination",
    kind: "Local storage",
    purpose:
      "Where you asked us to deliver, which sets the currency and the delivery price.",
    life: "Until you clear it",
    essential: true,
  },
  {
    name: "allternativ-wishlist",
    kind: "Local storage",
    purpose: "Items you saved for later.",
    life: "Until you clear it",
    essential: true,
  },
  {
    name: "allternativ:consent",
    kind: "Local storage",
    purpose:
      "Your answer to the question at the bottom of the screen, so we stop asking.",
    life: "Until you clear it",
    essential: true,
  },
  {
    name: "alt_vid",
    kind: "Cookie",
    purpose:
      "A random identifier that recognises your browser on a return visit, so two visits are not counted as two people. It carries no name, no email and nothing you typed.",
    life: "1 year",
    essential: false,
  },
  {
    name: "alt_sid",
    kind: "Session storage",
    purpose:
      "A random identifier for this one visit, used to group the pages of a single session together.",
    life: "Until you close the tab",
    essential: false,
  },
];

export default function CookiesPage() {
  return (
    <PolicyPage
      eyebrow="cookies"
      title="What we keep in your browser."
      standfirst="Six things, and only two of them are about measuring. The table is the whole list, not a summary of one."
    >
      <PolicySection title="The full list">
        <div className="mt-1 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-ink/15">
                <th className="eyebrow py-2 pr-4 font-normal text-brand-muted">
                  Name
                </th>
                <th className="eyebrow py-2 pr-4 font-normal text-brand-muted">
                  What for
                </th>
                <th className="eyebrow py-2 pr-4 font-normal text-brand-muted">
                  Lasts
                </th>
                <th className="eyebrow py-2 font-normal text-brand-muted">
                  Needs consent
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.name} className="border-b border-brand-ink/8">
                  <td className="py-3 pr-4 align-top">
                    <span className="font-mono text-xs text-brand-ink">
                      {row.name}
                    </span>
                    <br />
                    <span className="text-xs text-brand-muted">{row.kind}</span>
                  </td>
                  <td className="py-3 pr-4 align-top">{row.purpose}</td>
                  <td className="py-3 pr-4 align-top whitespace-nowrap">
                    {row.life}
                  </td>
                  <td className="py-3 align-top">
                    {row.essential ? "No" : "Yes"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PolicySection>

      <PolicySection title="What happens if you say no">
        <p>
          The two measuring ones are never set, and nothing else changes. The
          shop works, the basket fills, the checkout completes. Saying no costs
          you nothing except our knowing you were here.
        </p>
        <p>
          The four marked &ldquo;No&rdquo; above are kept either way. Each one
          exists because you asked for something &mdash; put this in my bag,
          send it to Spain, stop asking me about cookies &mdash; and none of
          them leaves your browser or identifies you.
        </p>
      </PolicySection>

      <PolicySection title="Changing your mind">
        <p>
          Clear this site&rsquo;s data in your browser settings and the question
          comes back on your next visit. We do not keep a copy of your answer
          anywhere else.
        </p>
      </PolicySection>

      <PolicySection title="Nobody else&rsquo;s cookies">
        <p>
          There are no advertising trackers, no social media pixels and no
          third-party analytics on this site. The measuring is ours and the data
          stays with us.
        </p>
        <p>
          Our payment page is hosted by Stripe and sets its own cookies while
          you are on it, which are necessary for the payment to work and to stop
          fraud. That happens on Stripe&rsquo;s page, under their policy.
        </p>
      </PolicySection>

      <PolicySection title="Questions">
        <p>
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-brand-ink underline underline-offset-2"
          >
            {COMPANY.contactEmail}
          </a>
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
