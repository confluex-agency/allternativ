import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { COMMERCIAL_ROLES } from "@/lib/roles";
import { formatCurrency } from "@/lib/utils";
import {
  listCustomersForAdmin,
  newsletterStatusFor,
  spendByCurrency,
} from "@/lib/customers-admin";

// Customers (section 18). Personal data, so COMMERCIAL_ROLES, like orders.
//
// ⚠️ Every column comes from the whitelist in `customers-admin.ts`, never from
// a query written here. That file carries the history of why: an unnamed
// select once shipped password hashes and live reset tokens.
//
// A customer row is created by the FIRST PURCHASE, not by signing up, so most
// rows here are guests. "Account" says which ones registered, and "Email
// proven" says which of those can see their own history.

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAdminPage(...COMMERCIAL_ROLES);

  const { page: pageParam, q } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const query = q?.slice(0, 100) ?? "";

  const { customers, total } = await listCustomersForAdmin({
    page,
    pageSize: PAGE_SIZE,
    query,
  });
  const [spend, newsletter] = await Promise.all([
    spendByCurrency(customers.map((c) => c.id)),
    newsletterStatusFor(customers.map((c) => c.email)),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) =>
    `/admin/customers?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <p className="mt-1 text-neutral-500">
        {total} {query ? "matching" : "in total"}. Everybody who has bought, and everybody who
        opened an account.
      </p>

      <form className="mt-6 flex max-w-md gap-2" action="/admin/customers">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by email or name"
          className="flex-1 rounded border bg-white px-3 py-1.5 text-sm"
        />
        <button className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed bg-white p-6 text-sm text-neutral-500">
          {query ? "Nobody matches that." : "No customers yet. A row appears with the first paid order."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 text-right font-medium">Orders</th>
                <th className="px-4 py-3 text-right font-medium">Spent</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Newsletter</th>
                <th className="px-4 py-3 font-medium">First seen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.map((c) => {
                return (
                  <tr key={c.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className="block">{c.name ?? "—"}</span>
                      <span className="block text-xs text-neutral-500">{c.email}</span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{c.country ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{c._count.orders}</td>
                    <td className="px-4 py-3 text-right">
                      {(spend.get(c.id) ?? []).map((s) => (
                        <span key={s.currency} className="block">
                          {formatCurrency(s.cents, s.currency)}
                        </span>
                      ))}
                      {!spend.get(c.id) && <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.hasAccount ? (
                        c.emailVerifiedAt ? (
                          <span className="text-green-700">Email proven</span>
                        ) : (
                          <span className="text-amber-600">Not proven yet</span>
                        )
                      ) : (
                        <span className="text-neutral-400">Guest</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">
                      {newsletter.get(c.email)?.toLowerCase() ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {c.createdAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                );
              })}
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
              <Link href={href(page - 1)} className="rounded-md border px-3 py-1.5 hover:bg-neutral-50">
                Previous
              </Link>
            )}
            {page < pageCount && (
              <Link href={href(page + 1)} className="rounded-md border px-3 py-1.5 hover:bg-neutral-50">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
