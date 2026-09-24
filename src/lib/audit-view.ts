// Reading the audit trail back (section 18: "activity log"; section 34:
// important commercial changes have to be traceable).
//
// `recordAudit()` has been writing since 2026-09-13 and nothing showed it, so
// the question it exists to answer — "why is this eleven when the invoice says
// twelve", "who changed the UK price" — could only be answered with SQL.
//
// ⚠️ Staff changes (`admin_user`: invitations, roles, deactivations) are shown
// to OWNER only. The trail is otherwise for the commercial roles, and an
// ECOMMERCE_ADMIN has no more business reading who was granted what than
// reaching `/admin/users`, which is OWNER-only for the reason spelled out in
// the sidebar.
//
// ⚠️ Nothing customer-identifying is written to `audit_logs` today (an order
// appears by its number), and that is what keeps this page free of the rules
// the order screens live under. Anything that starts writing a name, an address
// or an email of a CUSTOMER into `oldValue`/`newValue` changes that.

import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export const AUDIT_KINDS = {
  product_variant: "Stock",
  market_price: "Prices",
  order: "Orders",
  admin_user: "People",
} as const;

export type AuditKind = keyof typeof AUDIT_KINDS;

export function isAuditKind(value: unknown): value is AuditKind {
  return typeof value === "string" && value in AUDIT_KINDS;
}

export type AuditEntry = {
  id: string;
  at: Date;
  who: string;
  kind: string;
  label: string | null;
  /** One sentence a person can read without knowing the schema. */
  what: string;
  /** The reason typed at the time, when the form asked for one. */
  why: string | null;
};

type Json = Record<string, unknown> | null;

function asObject(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function money(cents: unknown, currency: unknown): string {
  return typeof cents === "number" && typeof currency === "string"
    ? formatCurrency(cents, currency)
    : "not set";
}

/**
 * The sentence for one row. Written per kind rather than as a generic
 * "field: old → new" dump, because the person reading this is a founder, and
 * `{"stockQuantity":11}` is not something they should have to decode.
 *
 * Anything this does not recognise still gets a line, from the raw values:
 * a new kind of change must never be invisible here just because nobody wrote
 * its sentence yet.
 */
export function describe(
  entityType: string,
  action: string,
  oldValue: unknown,
  newValue: unknown,
): string {
  const before = asObject(oldValue);
  const after = asObject(newValue);

  switch (entityType) {
    case "product_variant":
      if (after && "stockQuantity" in after) {
        return `Stock ${before?.stockQuantity ?? "?"} → ${after.stockQuantity}`;
      }
      break;
    case "market_price":
      if (after && "priceCents" in after) {
        return `${after.market ?? ""} price ${money(before?.priceCents, before?.currency)} → ${money(after.priceCents, after.currency)}`.trim();
      }
      break;
    case "order":
      if (after && "status" in after && before && "status" in before) {
        return `Status ${before.status} → ${after.status}`;
      }
      if (after && "trackingNumber" in after) {
        return `Dispatched by hand, ${after.carrier ?? "carrier not given"} ${after.trackingNumber}`;
      }
      break;
    case "admin_user":
      if (action === "create") return `Invited as ${after?.role ?? "?"}`;
      if (after && "role" in after) return `Role ${before?.role ?? "?"} → ${after.role}`;
      if (after && "isActive" in after) {
        return after.isActive ? "Reactivated" : "Deactivated";
      }
      if (after && "sent" in after) return `Sent a ${after.sent}`;
      break;
  }

  const parts = [
    before ? `from ${JSON.stringify(before)}` : null,
    after ? `to ${JSON.stringify(after)}` : null,
  ].filter(Boolean);
  return `${action} ${parts.join(" ")}`.trim();
}

export async function listAudit(opts: {
  kind: AuditKind | null;
  includeStaff: boolean;
  page: number;
  pageSize: number;
}): Promise<{ entries: AuditEntry[]; total: number }> {
  const where = opts.kind
    ? { entityType: opts.kind }
    : opts.includeStaff
      ? {}
      : { entityType: { not: "admin_user" } };

  // Asked for a kind this person may not read: an empty page, not an error.
  if (opts.kind === "admin_user" && !opts.includeStaff) {
    return { entries: [], total: 0 };
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.pageSize,
      skip: (opts.page - 1) * opts.pageSize,
      select: {
        id: true,
        createdAt: true,
        adminEmail: true,
        action: true,
        entityType: true,
        entityLabel: true,
        oldValue: true,
        newValue: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    total,
    entries: rows.map((r) => {
      const after = asObject(r.newValue);
      return {
        id: r.id,
        at: r.createdAt,
        who: r.adminEmail,
        kind: AUDIT_KINDS[r.entityType as AuditKind] ?? r.entityType,
        label: r.entityLabel,
        what: describe(r.entityType, r.action, r.oldValue, r.newValue),
        why: typeof after?.reason === "string" ? after.reason : null,
      };
    }),
  };
}
