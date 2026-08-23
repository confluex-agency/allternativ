// The company facts every policy page needs, and does not have yet.
//
// Allternativ is not registered as a company. That is item 1 of the client's own
// pending list and it holds up items 2, 4, 5, 6 and 11 behind it. Meanwhile the
// Shipping and Returns pages can be written, because the commercial logic in
// them was decided in writing: delivery windows, the returns window, who pays
// return postage, what happens to a lost parcel.
//
// So the pages get built with the facts we have and NOTHING invented in the
// gaps. A registered address is not the kind of thing to fill with a plausible
// string until the real one arrives.
//
// ⚠️ The pages carry a visible notice while anything below is null, in every
// environment and not just development. The reasoning: if these details are
// missing the shop should not be open at all, and if it somehow is, telling a
// reader that the terms are not final is more honest than presenting an
// incomplete policy as a complete one. Fill these in and the notice disappears
// on its own, with nothing else to remember.

export const COMPANY = {
  /** Registered legal name. Null until the company exists. */
  legalName: null as string | null,
  /** Registered address, as it must appear on the policies. */
  registeredAddress: null as string | null,
  /** Company registration number. */
  registrationNumber: null as string | null,
  /** VAT number, once registered. */
  vatNumber: null as string | null,
  /** IOSS number. Without it, EU customers can be billed duty on delivery. */
  iossNumber: null as string | null,
  /**
   * Where customer questions go.
   *
   * ⚠️ NOT CONFIRMED. This is the address the contact page has always shown,
   * kept as the single source so the site cannot end up quoting two different
   * ones. It is question D2 of the build plan; change it here and it changes
   * everywhere at once.
   */
  contactEmail: "hola@allternativ.com",
};

/** True once the policies can be presented as final. */
export function legalDetailsComplete(): boolean {
  return Boolean(
    COMPANY.legalName &&
      COMPANY.registeredAddress &&
      COMPANY.registrationNumber,
  );
}

/**
 * Change-of-mind returns. Their words: fourteen days, "unused, undamaged and
 * returned in their original packaging", and the customer pays return postage.
 */
export const RETURNS = {
  windowDays: 14,
  /**
   * ⚠️ KEPT AS THE CLIENT WROTE IT, AND DELIBERATELY NOT USED AS THE PAGE'S
   * WORDING. As an absolute bar, "unused" is stronger than European law
   * permits: the fourteen-day right of withdrawal lets a buyer examine goods
   * as they would in a shop, and a trader may REDUCE a refund for value lost
   * beyond that, not refuse it outright.
   *
   * The page describes the line concretely instead — try them on indoors,
   * wearing them out is not trying them on, a worn pair is refunded at what it
   * is still worth. That is both lawful and something a person can act on.
   *
   * ⬜ OPEN: how much is deducted, and who decides. That is a commercial
   * decision nobody has made, and the first argument about it will be with a
   * real customer unless it is made first.
   */
  condition: "Unused, undamaged, and returned in their original packaging.",
  /** Who pays to send it back when someone simply changed their mind. */
  changeOfMindPostage: "customer" as const,
};

/**
 * Where a return travels, by market. The addresses themselves are deliberately
 * absent: "las direcciones exactas se proporcionarán más adelante y no deberían
 * publicarse todavía". Publishing a return address that turns out to be wrong
 * sends parcels to a place nobody is collecting them from.
 */
export const RETURN_REGIONS = [
  { markets: "European Union, United Kingdom, United States, Canada", hub: "Ireland" },
  { markets: "Australia, New Zealand", hub: "Australia" },
];

/** The carrier they want as standard, with an alternative only where it cannot reach. */
export const CARRIER = "YunExpress";
