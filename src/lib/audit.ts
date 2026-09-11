// Section 34 of the brief: important commercial changes have to be traceable.
//
// `audit_logs` has been in the schema since the beginning and **nothing has
// ever written to it**, because until now nothing in the admin changed a
// commercial record — every screen was read-only and the only writes came from
// Stripe or from the supplier's own system, both of which leave their own
// trail (`webhook_events`, `woo_request_logs`).
//
// The order controls are the first exception, so this is where it starts. One
// function rather than an inline `prisma.auditLog.create` per call site, for
// the reason `requireRole` exists: the thing everybody is supposed to remember
// is the thing somebody eventually does not.
//
// ⚠️ Deliberately NOT a foreign key to `AdminUser`. The log has to outlive the
// account that made the change — people leave, accounts get deleted, and a
// history that loses its author the day somebody is offboarded is not a
// history. The email is copied in as a value, and the id is kept beside it as
// a convenience for as long as the row exists.

import { prisma } from "@/lib/prisma";
import type { JWTPayload } from "@/lib/auth";

export type AuditAction = "create" | "update" | "delete" | "publish";

export async function recordAudit(opts: {
  actor: JWTPayload;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** The human name at the time — an order number, a product name. */
  entityLabel?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: opts.actor.sub,
        adminEmail: opts.actor.email,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId ?? null,
        entityLabel: opts.entityLabel ?? null,
        oldValue: (opts.oldValue ?? null) as never,
        newValue: (opts.newValue ?? null) as never,
      },
    });
  } catch (error) {
    // ⚠️ A failed audit write must not undo the change it describes.
    //
    // The alternative — throwing, so the whole operation rolls back — sounds
    // more rigorous and is worse here: it would mean a full `audit_logs` table
    // or a bad JSON column could stop the shop marking an order shipped, which
    // stops the buyer being told their parcel is moving. The change is the
    // thing that matters; the record of it is second.
    //
    // It is loud rather than silent, because an audit trail that quietly stops
    // recording is worse than one that was never there — somebody would read
    // its emptiness as "nothing happened".
    console.error(
      `[audit] FAILED to record ${opts.action} on ${opts.entityType}` +
        `${opts.entityId ? ` ${opts.entityId}` : ""} by ${opts.actor.email}: ` +
        `${error instanceof Error ? error.message : "unknown error"}. ` +
        `The change itself went through and is NOT in the audit trail.`,
    );
  }
}
