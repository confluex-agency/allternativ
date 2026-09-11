// Which order statuses a person is allowed to set, and nothing else.
//
// ⚠️ This lives apart from `orders-admin.ts` for exactly the reason `roles.ts`
// lives apart from `auth.ts`, and the build says so out loud if you forget:
// `orders-admin.ts` imports Prisma, so anything that touches it is server-only.
// The controls on the order screen are a client component and need this list
// to render the buttons — importing it from there pulled Prisma into the
// browser bundle and the production build died with `Can't resolve 'fs'`.
//
// A list of two strings does not need a database client behind it.
//
// ── Why the list is what it is ──────────────────────────────────────────────
//
// PROCESSING says "we have seen it, it is being prepared" and promises nothing
// downstream. CANCELLED records a decision already taken elsewhere.
//
// Not here, and each for its own reason:
//
//   SHIPPED / DELIVERED — **not statuses anybody picks.** They are what a
//     tracking number means. Both doors from the supplier write the status and
//     the number together (`/api/erp/tracking` in one update, and the
//     WooCommerce façade forces SHIPPED whenever a number arrives), and the
//     dispatch email is only sent when BOTH are present. A picker that could
//     say SHIPPED on its own would leave an order marked shipped with nothing
//     to track — skipped by the sweep for ever, no failed row, and the buyer
//     never told their parcel is moving.
//   REFUNDED — the money lives in Stripe. A status claiming a refund that did
//     not happen is worse than no status, because the next person reads it and
//     stops looking.
//   PAID — written by the Stripe webhook when the money actually moved.
//     Nothing else may claim it.
//
// This array IS the control: the route's zod enum is built from it, so a value
// that is not here cannot be expressed by any request at all.
export const MANUAL_STATUSES = ["PROCESSING", "CANCELLED"] as const;

export type ManualStatus = (typeof MANUAL_STATUSES)[number];
