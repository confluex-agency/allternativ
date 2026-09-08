import type { AdminRole } from "@/generated/prisma/enums";

// Who may see what, from section 18 of the client brief.
//
// ⚠️ These live apart from `auth.ts` on purpose. `auth.ts` imports `jose`,
// `next/headers` and Prisma, so anything that touches it is server-only — and
// the admin sidebar is a client component that has to decide whether to offer
// the Orders link at all. Importing the rule from there would pull the whole
// authentication stack into the browser bundle.
//
// Names, not booleans, and one list rather than a check repeated per screen:
// `/api/orders` and `/api/customers` once carried no check whatsoever, and the
// way that happened was a role test written inline, per route, until one route
// was written without it.

/** Roles that may see commercial data: orders, customers, money. */
export const COMMERCIAL_ROLES: AdminRole[] = ["OWNER", "ECOMMERCE_ADMIN"];

/**
 * Roles that may read dashboards. All of them — ANALYTICS_VIEWER exists for
 * exactly this and nothing else.
 */
export const REPORTING_ROLES: AdminRole[] = [
  "OWNER",
  "ECOMMERCE_ADMIN",
  "CONTENT_ADMIN",
  "ANALYTICS_VIEWER",
];

/** True if `role` is one of `allowed`. Accepts the widened string a client hook carries. */
export function hasRole(role: string | undefined, allowed: AdminRole[]): boolean {
  return Boolean(role) && (allowed as string[]).includes(role as string);
}
