import Link from "next/link";
import {
  PolicyPage,
  PolicySection,
} from "@/components/storefront/policy-page";
import { RETURNS, RETURN_REGIONS, COMPANY } from "@/lib/legal";

export const metadata = {
  title: "Returns",
  description:
    "Fourteen days to change your mind. Anything faulty or wrong, we sort out.",
};

export default function ReturnsPage() {
  return (
    <PolicyPage
      eyebrow="returns"
      title="If it isn't right."
      standfirst={`${RETURNS.windowDays} days to change your mind, and no time limit on us putting right something we got wrong.`}
    >
      {/* ⚠️ The client's own wording was "unused, undamaged and returned in
          their original packaging", and as an absolute bar that is stronger
          than European law allows. The 14-day right of withdrawal lets a buyer
          examine goods as they would in a shop, and a trader may REDUCE a
          refund for value lost beyond that — not refuse it. Writing "unused"
          and then having to refund anyway is worse than explaining the line, so
          the line is described concretely instead. "Try them on the way you
          would in a shop" is a sentence people can act on; "unused" is not. */}
      <PolicySection title="Changed your mind">
        <p>
          You have{" "}
          <strong className="font-medium text-brand-ink">
            {RETURNS.windowDays} days
          </strong>{" "}
          from the day your order arrives to send them back, and return postage
          is yours.
        </p>
        <p>
          Try them on the way you would in a shop: in front of a mirror, for as
          long as you like, indoors. That is what the {RETURNS.windowDays} days
          are for, and it is what we expect people to do.
        </p>
        <p>
          Wearing them out is not trying them on. A pair that comes back
          scratched, sun-bleached, or without the case and box it arrived in has
          lost value, and we refund what it is still worth rather than the full
          price. We will always tell you the figure before we process it, and
          you can have the pair sent back to you instead if you would rather.
        </p>
        <p>
          Write to us before sending anything, so it goes to the right place.
        </p>
      </PolicySection>

      {/* Their instruction, and a sensible one: "las direcciones exactas se
          proporcionarán más adelante y no deberían publicarse todavía". A
          return address that turns out to be wrong sends parcels somewhere
          nobody is collecting them from, and the customer pays for that twice.
          The regions are published because they set the expectation; the
          street addresses arrive by email once the return is agreed. */}
      <PolicySection title="Where returns go">
        <p>
          Returns are handled regionally, so nothing has to travel further than
          it needs to.
        </p>
        <ul className="mt-1 flex flex-col gap-2">
          {RETURN_REGIONS.map((region) => (
            <li key={region.hub} className="flex flex-col gap-0.5">
              <span className="text-brand-ink">{region.markets}</span>
              <span className="text-sm text-brand-muted">
                Returned to our {region.hub} hub
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm">
          We send the exact address when we confirm your return, rather than
          publishing it here, so a parcel never leaves for an address that has
          since changed.
        </p>
      </PolicySection>

      <PolicySection title="Faulty, damaged, or not what you ordered">
        <p>
          That one is ours. Send us a photo and your order number and we will
          replace it or refund it. You do not pay to return a faulty pair, and
          this sits outside the {RETURNS.windowDays}-day window.
        </p>
      </PolicySection>

      <PolicySection title="Your legal rights">
        <p>
          Nothing here reduces the rights you have where you live. Consumer law
          in your market applies on top of this policy, and where the two
          differ, the law wins.
        </p>
      </PolicySection>

      <PolicySection title="Starting a return">
        <p>
          Email{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="text-brand-ink underline underline-offset-2"
          >
            {COMPANY.contactEmail}
          </a>{" "}
          with your order number and what you would like to do. Or use the{" "}
          <Link
            href="/contact"
            className="text-brand-ink underline underline-offset-2"
          >
            contact form
          </Link>
          .
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
