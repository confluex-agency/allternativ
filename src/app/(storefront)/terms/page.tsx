import Link from "next/link";
import {
  PolicyPage,
  PolicySection,
} from "@/components/storefront/policy-page";
import { COMPANY, RETURNS } from "@/lib/legal";
import { DELIVERY_ESTIMATE_BUSINESS_DAYS } from "@/lib/shipping";

export const metadata = {
  title: "Terms",
  description:
    "The terms you buy under: prices, orders, delivery, returns and what to do if something goes wrong.",
};

// ⚠️ This page is structure and commercial logic, not final legal drafting.
//
// Every operational fact in it comes from a decision the client wrote down: the
// delivery window, the returns window, who pays return postage, what happens to
// a lost parcel, the six regional prices. What is deliberately missing is the
// half that cannot be written yet — the legal entity, its address, its
// registration number and its VAT position — and the notice at the top says so
// for as long as those are missing.
//
// The one thing not to do here is write a governing-law clause. It depends on
// where the company is registered, which is not decided, and a guess would be
// the single most damaging sentence on the site.

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="terms"
      title="The terms you buy under."
      standfirst="Plain versions of the rules. Where the law where you live gives you more than this page does, the law wins."
    >
      <PolicySection title="Prices">
        <p>
          Prices are shown in the currency of the market you are shopping from,
          and each market has its own price rather than a daily conversion of
          one. Delivery is shown as its own line before you pay, never folded
          into the price of the eyewear.
        </p>
        <p>
          If a price is obviously wrong &mdash; a decimal point in the wrong
          place &mdash; we will contact you and cancel rather than hold you to
          it or quietly ship at the wrong price.
        </p>
      </PolicySection>

      <PolicySection title="Your order">
        <p>
          An order is confirmed when your payment succeeds. Until then nothing
          is reserved for longer than the checkout stays open.
        </p>
        <p>
          Very rarely, stock can run out between two people paying at the same
          moment. If it happens to you we refund in full and tell you straight
          away, and we do not substitute a different colour without asking.
        </p>
      </PolicySection>

      <PolicySection title="Delivery">
        <p>
          {DELIVERY_ESTIMATE_BUSINESS_DAYS.minimum} to{" "}
          {DELIVERY_ESTIMATE_BUSINESS_DAYS.maximum} business days, tracked, with
          a tracking number when the parcel leaves. The full detail, including
          what delivery costs to each country, is on the{" "}
          <Link
            href="/shipping"
            className="text-brand-ink underline underline-offset-2"
          >
            shipping page
          </Link>
          .
        </p>
        <p>
          Customs can add days at either end and no carrier controls that, which
          is why the window is drawn wide rather than optimistically.
        </p>
      </PolicySection>

      <PolicySection title="Returns">
        <p>
          {RETURNS.windowDays} days to change your mind on eligible items,
          return postage yours. Anything faulty or wrong is ours to put right,
          with no time limit and nothing for you to pay. The detail is on the{" "}
          <Link
            href="/returns"
            className="text-brand-ink underline underline-offset-2"
          >
            returns page
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="Using this site">
        <p>
          The words, photographs and design here are ours. Read them, share a
          link, quote a line. Do not copy the catalogue wholesale to sell
          something else.
        </p>
      </PolicySection>

      <PolicySection title="Your rights come first">
        <p>
          Consumer law in your own market applies on top of everything above,
          and where the two disagree, the law wins. Nothing on this page removes
          a right you have.
        </p>
      </PolicySection>

      <PolicySection title="Talking to a person">
        <p>
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-brand-ink underline underline-offset-2"
          >
            {COMPANY.contactEmail}
          </a>
          . We would much rather sort something out by email than have you
          reading terms.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
