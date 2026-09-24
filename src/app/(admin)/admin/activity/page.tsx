import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { COMMERCIAL_ROLES, OWNER_ONLY, hasRole } from "@/lib/roles";
import {
  AUDIT_KINDS,
  isAuditKind,
  listAudit,
  type AuditKind,
} from "@/lib/audit-view";

// Who changed what, and why (sections 18 and 34). Read-only by nature: a trail
// that can be edited from the screen that shows it is not a trail.
//
// COMMERCIAL_ROLES, because the rows are stock and prices and order statuses —
// the same things those roles may change. Staff changes are OWNER-only inside
// it; see `audit-view.ts`.

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; kind?: string }>;
}) {
  const user = await requireAdminPage(...COMMERCIAL_ROLES);
  const includeStaff = hasRole(user.role, OWNER_ONLY);

  const { page: pageParam, kind: kindParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const kind = isAuditKind(kindParam) ? kindParam : null;

  const { entries, total } = await listAudit({
    kind,
    includeStaff,
    page,
    pageSize: PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const kinds = (Object.keys(AUDIT_KINDS) as AuditKind[]).filter(
    (k) => includeStaff || k !== "admin_user",
  );
  const href = (next: { kind?: AuditKind | null; page?: number }) => {
    const params = new URLSearchParams();
    const k = next.kind === undefined ? kind : next.kind;
    if (k) params.set("kind", k);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const q = params.toString();
    return `/admin/activity${q ? `?${q}` : ""}`;
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold">Activity</h1>
      <p className="mt-1 text-neutral-500">
        Every change made from this admin, newest first. Sales, payments and the
        supplier&apos;s updates are not here: they leave their own records.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href={href({ kind: null })}
          className={`rounded-full border px-3 py-1 ${
            kind === null ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"
          }`}
        >
          All
        </Link>
        {kinds.map((k) => (
          <Link
            key={k}
            href={href({ kind: k })}
            className={`rounded-full border px-3 py-1 ${
              kind === k ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"
            }`}
          >
            {AUDIT_KINDS[k]}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed bg-white p-8 text-sm text-neutral-500">
          Nothing recorded{kind ? ` under ${AUDIT_KINDS[kind]}` : ""} yet. A row
          appears the moment somebody changes stock, a price, an order or an
          account from this admin.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">When (UTC)</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">On</th>
                <th className="px-4 py-3 font-medium">What</th>
                <th className="px-4 py-3 font-medium">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                    {e.at.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-3">{e.who}</td>
                  <td className="px-4 py-3">
                    <span className="block text-xs uppercase tracking-wide text-neutral-400">
                      {e.kind}
                    </span>
                    <span className="font-mono text-xs">{e.label ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">{e.what}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {e.why ?? <span className="text-neutral-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={href({ page: page - 1 })}
                className="rounded-md border px-3 py-1.5 hover:bg-neutral-50"
              >
                Previous
              </Link>
            )}
            {page < pageCount && (
              <Link
                href={href({ page: page + 1 })}
                className="rounded-md border px-3 py-1.5 hover:bg-neutral-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
