import Link from "next/link";
import {
  PolicyPage,
  PolicySection,
} from "@/components/storefront/policy-page";
import { COMPANY } from "@/lib/legal";
import { RETURNS } from "@/lib/legal";

export const metadata = {
  title: "Privacy",
  description:
    "What we collect, who else sees it, and what you can ask us to do with it.",
};

// Written against the schema and the code, not from a template. Every claim
// below can be checked: the customer fields are in `prisma/schema.prisma`, the
// analytics fields are on `Session` and `TrackingEvent`, the supplier hand-off
// is `src/lib/woo/order-mapper.ts`, and the payment never touches this server
// at all.
//
// ⚠️ THE PARAGRAPH ABOUT CHINA IS THE ONE THAT MATTERS. A customer's name,
// address and phone number are sent to a fulfilment partner in Shenzhen so the
// parcel can be packed and posted. Under EU law that is a transfer to a country
// with no adequacy decision, and it needs a signed contractual basis rather
// than a sentence on a web page. Saying so plainly is the least we can do while
// that is being arranged; it is also item 1 of the client's pending list, since
// nobody can sign anything until the company exists.

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="privacy"
      title="What we know about you."
      standfirst="Short version: what you type to buy something, and if you allow it, a count of the pages you looked at. Nothing is sold, and nothing is shared with advertisers."
    >
      <PolicySection title="What we collect">
        <p>
          <strong className="font-medium text-brand-ink">
            When you buy something.
          </strong>{" "}
          Your name, email address, delivery address, and phone number. The
          phone number is not optional and not marketing: couriers use it when
          they cannot find an address.
        </p>
        <p>
          <strong className="font-medium text-brand-ink">
            When you browse, and only if you allowed it.
          </strong>{" "}
          Which pages you opened and in what order, the site that sent you here,
          your browser and device type, and an approximate country and city. We
          store a one-way scramble of your IP address rather than the address
          itself, so it can tell two visitors apart without telling us who
          either of them is.
        </p>
        <p>
          <strong className="font-medium text-brand-ink">
            Your card details, never.
          </strong>{" "}
          Payment happens on a page hosted by Stripe. Card numbers do not pass
          through this site and are not stored on it.
        </p>
      </PolicySection>

      <PolicySection title="Who else sees it">
        <p>
          <strong className="font-medium text-brand-ink">Stripe</strong>, to
          take the payment. They see your email, your address and your card.
        </p>
        <p>
          <strong className="font-medium text-brand-ink">
            Our fulfilment partner in China
          </strong>
          , to pack and post your order. They receive your name, delivery
          address, phone number and what you bought. They never receive payment
          details.
        </p>
        <p>
          That last one deserves saying plainly rather than burying: your
          delivery details leave the European Union and travel to Shenzhen,
          because that is where the eyewear is stored and posted from. There is
          no way to send you a parcel from there without telling them where you
          live. If that is not something you want, we would rather you knew
          before ordering than after.
        </p>
        <p>
          Nothing is sold to anyone, and nothing is shared with advertisers.
          There are no advertising trackers on this site.
        </p>
      </PolicySection>

      <PolicySection title="How long we keep it">
        <p>
          Orders are kept for as long as tax and accounting rules require, which
          is several years and is not our choice. Analytics is kept in a form
          that stops identifying anyone long before that.
        </p>
      </PolicySection>

      <PolicySection title="What you can ask for">
        <p>
          A copy of what we hold, a correction, or deletion. Deletion has one
          real limit: an order we are legally required to keep cannot be erased
          while that requirement lasts, and pretending otherwise would be a
          promise we could not keep.
        </p>
        <p>
          You can also withdraw your consent to being measured at any time by
          clearing this site&rsquo;s data in your browser, and you can refuse it
          in the first place without losing anything &mdash; see the{" "}
          <Link
            href="/cookies"
            className="text-brand-ink underline underline-offset-2"
          >
            cookie page
          </Link>
          .
        </p>
        <p>
          Write to{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-brand-ink underline underline-offset-2"
          >
            {COMPANY.contactEmail}
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="Marketing">
        <p>
          We only email you about an order unless you asked for more. If you
          subscribe, every message has an unsubscribe link that works
          immediately, and buying something does not sign you up.
        </p>
      </PolicySection>

      <PolicySection title="Returns and your data">
        <p>
          A return within {RETURNS.windowDays} days means an exchange of
          messages and, usually, a photograph. We keep those with the order for
          the same period and nothing longer.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
