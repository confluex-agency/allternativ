import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-guard";
import { COMMERCIAL_ROLES } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { OrderStatusBadge, EmailStatusBadge } from "@/components/admin/badges";

// The order book.
//
// ⚠️ Read-only, deliberately. An order is a record of something that already
// happened and was paid for; the fields that could sensibly be edited from here
// (status, tracking) are written by the supplier's ERP through /api/erp/tracking,
// and a second writer would let the two disagree about the same parcel. When
// there is a reason to edit one by hand, it needs to be one specific action —
// "mark refunded", say — not a form over the row.
//
// It goes through the same guard as the API: orders carry the buyer's name,
// address and phone, so being signed in is not enough. COMMERCIAL_ROLES is
// OWNER and ECOMMERCE_ADMIN, matching the table in CLAUDE.md.

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdminPage(...COMMERCIAL_ROLES);

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        customer: { select: { email: true, name: true } },
        // Only what the row shows. The lines themselves are on the detail page,
        // and pulling every one of them here is a query that grows with the
        // shop for a number that fits in a column.
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Orders</h1>
      <p className="mt-1 text-neutral-500">
        {total === 0
          ? "No orders yet."
          : `${total} order${total === 1 ? "" : "s"}.`}
      </p>

      {total === 0 ? (
        // Not a blank screen. Somebody looking at an empty order book on launch
        // day needs to know whether that means "nobody has bought" or "something
        // is broken", and those have completely different next steps.
        <div className="mt-8 rounded-lg border border-dashed bg-white p-8 text-sm text-neutral-500">
          <p className="font-medium text-neutral-700">Nothing has sold yet.</p>
          <p className="mt-2 max-w-xl">
            An order appears here only once Stripe confirms the payment and
            calls our webhook — never at checkout. So if a test card was charged
            and nothing shows up, the payment is not the thing to look at: check
            that a webhook endpoint exists in Stripe and that its signing secret
            matches <code>STRIPE_WEBHOOK_SECRET</code>.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Placed</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Pairs</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Confirmation</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium underline underline-offset-2"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                    {order.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{order.customer?.name ?? "—"}</span>
                    <span className="block text-xs text-neutral-500">
                      {order.customer?.email ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {order._count.items}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                    {formatCurrency(order.totalCents, order.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <EmailStatusBadge status={order.emailStatus} />
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
                href={`/admin/orders?page=${page - 1}`}
                className="rounded-md border px-3 py-1.5 hover:bg-neutral-50"
              >
                Previous
              </Link>
            )}
            {page < pageCount && (
              <Link
                href={`/admin/orders?page=${page + 1}`}
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
