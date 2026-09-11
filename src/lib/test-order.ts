// Telling the supplier that an order is a rehearsal.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// On 2026-09-11 the supplier looked at an order that had reached Dianxiaomi
// through the WooCommerce façade — three pairs, EUR 117, correct SKUs, correct
// case colours, real name and address — and **had to ask whether it was a
// test.** Nothing in what he receives said so. He was right to ask, and the
// answer was yes.
//
// That question is cheap to ask once and expensive to get wrong once. The day
// the shop is live, an unmarked test order is a parcel somebody pays to send
// to nobody — or, the other way round, a real order hesitated over because it
// looked like another rehearsal. Neither is a code failure; both are the
// consequence of the supplier not being told something we knew.
//
// ⚠️ The signal is Stripe's own and needs no new column. A Checkout session id
// in test mode starts with `cs_test_`; in live mode it starts with `cs_live_`.
// That prefix is the same fact as `livemode: false` on the session, available
// without a round trip, and it cannot drift from the truth because Stripe
// writes it.
//
// Test orders are still sent through, deliberately — refusing to forward them
// would mean the integration could never be exercised end to end, which is the
// whole point of a rehearsal. They are forwarded and labelled.

/** Stripe's own marker. Live sessions begin `cs_live_`. */
const TEST_SESSION_PREFIX = "cs_test_";

export function isTestOrder(order: { stripeSessionId: string | null }): boolean {
  return order.stripeSessionId?.startsWith(TEST_SESSION_PREFIX) ?? false;
}

/**
 * The label, in both languages that matter here.
 *
 * English because it is the language this integration is documented in, and
 * Chinese because Dianxiaomi is a Chinese application read by Chinese-speaking
 * staff, and a warning nobody reads is decoration.
 *
 * ⚠️ The Chinese wording has NOT been confirmed with the supplier. It is
 * `测试订单` (test order) and `请勿发货` (do not ship), which are the standard
 * phrases — but the English half stands on its own, so a wrong nuance in the
 * Chinese cannot make this worse than the nothing it replaced. Confirm it and
 * adjust the constant; nothing else changes.
 */
export const TEST_ORDER_LABEL =
  "*** TEST ORDER - DO NOT SHIP *** 测试订单，请勿发货 ***";

/** Prefixes a supplier-facing note when the order is a rehearsal. */
export function labelIfTest(
  order: { stripeSessionId: string | null },
  note: string,
): string {
  if (!isTestOrder(order)) return note;
  return note ? `${TEST_ORDER_LABEL} | ${note}` : TEST_ORDER_LABEL;
}
