import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-guard";
import { COMMERCIAL_ROLES } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { OrderControls } from "@/components/admin/order-controls";
import { fulfilmentSku } from "@/lib/sku";
import { OrderStatusBadge, EmailStatusBadge } from "@/components/admin/badges";

// One order, in full.
//
// ⚠️ Everything on this page is read from the ORDER, never from the catalogue.
// The order froze the SKU, the product name, the colourway, the case colour and
// the price paid precisely so that a catalogue edit cannot rewrite history —
// and a screen that "helpfully" joined back to the live product would undo that
// on the one screen where somebody is checking what to ship.
//
// The exception is deliberate and marked: the case colour is an option of the
// purchase rather than a variant, so the SKU the warehouse picks by is the
// frozen variant SKU with the case appended. `fulfilmentSku` is the one place
// that rule lives.

export const dynamic = "force-dynamic";

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-1.5">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={strong ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage(...COMMERCIAL_ROLES);

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { orderBy: { id: "asc" } },
    },
  });

  if (!order) notFound();

  const address = [
    order.shippingName,
    order.shippingAddress,
    order.shippingAddress2,
    [order.shippingZip, order.shippingCity].filter(Boolean).join(" "),
    order.shippingState,
    order.shippingCountry,
  ].filter(Boolean);

  const pairs = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/orders"
        className="text-sm text-neutral-500 underline underline-offset-2"
      >
        ← Orders
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.status} />
        <EmailStatusBadge status={order.emailStatus} />
      </div>
      <p className="mt-1 text-neutral-500">
        {order.createdAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
        {pairs} pair{pairs === 1 ? "" : "s"}
      </p>

      {order.emailStatus === "PENDING" && (
        <p className="mt-4 rounded-md border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The confirmation email is queued and has not gone out. It is sent by
          the <code>sweep</code> job, so this stays here until that is scheduled
          and an email provider is configured.
        </p>
      )}
      {order.emailStatus === "FAILED" && (
        <p className="mt-4 rounded-md border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900">
          The confirmation email will not be sent. The buyer was told on the
          success page that one was coming, so somebody has to write to them.
          {order.emailLastError ? ` Reason: ${order.emailLastError}` : ""}
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">What was bought</th>
              <th className="px-4 py-3 font-medium">SKU to pick</th>
              <th className="px-4 py-3 text-right font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Unit</th>
              <th className="px-4 py-3 text-right font-medium">Line</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <span className="block font-medium">
                    {item.productName ?? "—"}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {item.variantName ?? "—"}
                    {item.caseColor
                      ? ` · ${item.caseColor.toLowerCase()} case`
                      : ""}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {item.sku ? fulfilmentSku(item.sku, item.caseColor) : "—"}
                </td>
                <td className="px-4 py-3 text-right">{item.quantity}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {formatCurrency(item.unitPriceCents, order.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                  {formatCurrency(
                    item.unitPriceCents * item.quantity,
                    order.currency,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Money
          </h2>
          <dl className="mt-3 text-sm">
            <Row
              label="Subtotal"
              value={formatCurrency(order.subtotalCents, order.currency)}
            />
            {order.discountCents > 0 && (
              <Row
                label={`Discount${order.promotionCode ? ` (${order.promotionCode})` : ""}`}
                value={`−${formatCurrency(order.discountCents, order.currency)}`}
              />
            )}
            <Row
              label="Delivery charged"
              value={
                order.shippingCents === 0
                  ? "Free"
                  : formatCurrency(order.shippingCents, order.currency)
              }
            />
            <Row
              label="Total"
              strong
              value={formatCurrency(order.totalCents, order.currency)}
            />
            {order.refundedCents > 0 && (
              <Row
                label="Refunded"
                value={formatCurrency(order.refundedCents, order.currency)}
              />
            )}
          </dl>

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            What it cost us
          </h2>
          {/* Frozen on the order, not looked up. The whole point of freezing
              them is that "what did we make" keeps answering the same thing
              after the supplier raises a price. */}
          <dl className="mt-3 text-sm">
            <Row
              label="Goods"
              value={
                order.items.every((i) => i.unitCostCents !== null)
                  ? formatCurrency(
                      order.items.reduce(
                        (n, i) => n + (i.unitCostCents ?? 0) * i.quantity,
                        0,
                      ),
                      order.currency,
                    )
                  : "Not recorded"
              }
            />
            <Row
              label="Parcel"
              value={formatCurrency(order.shippingCostCents, order.currency)}
            />
            <Row
              label="Processor fee"
              value={
                order.paymentFeeCents === null
                  ? // Not zero. A missing fee inflates the margin by two or
                    // three per cent, and saying "—" is what stops that being
                    // mistaken for a free transaction.
                    "Unknown"
                  : formatCurrency(order.paymentFeeCents, order.currency)
              }
            />
          </dl>
        </section>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Ship to
          </h2>
          <p className="mt-3 text-sm">
            {address.length > 0 ? (
              address.map((line) => <span key={line} className="block">{line}</span>)
            ) : (
              <span className="text-neutral-400">No address on the order.</span>
            )}
          </p>
          {order.shippingPhone && (
            <p className="mt-2 text-sm text-neutral-500">
              {order.shippingPhone}
            </p>
          )}
          <p className="mt-3 text-sm">
            <span className="block">{order.customer?.name ?? "—"}</span>
            <span className="block text-neutral-500">
              {order.customer?.email ?? "—"}
            </span>
          </p>

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Fulfilment
          </h2>
          <dl className="mt-3 text-sm">
            <Row
              label="Sent to supplier"
              value={
                order.erpExportedAt
                  ? order.erpExportedAt.toISOString().slice(0, 10)
                  : "Not yet"
              }
            />
            <Row label="Carrier" value={order.carrier ?? "—"} />
            <Row
              label="Tracking"
              value={
                order.trackingNumber ? (
                  <span className="font-mono text-xs">
                    {order.trackingNumber}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Row
              label="Shipped"
              value={
                order.shippedAt
                  ? order.shippedAt.toISOString().slice(0, 10)
                  : "—"
              }
            />
            <Row
              label="Tracking email"
              value={
                // "Queued" on an order that has not shipped is not a backlog:
                // the mail is not late, it is not due. Saying so stops somebody
                // chasing a queue that is behaving.
                order.trackingNumber === null
                  ? "Not due yet"
                  : <EmailStatusBadge status={order.dispatchEmailStatus} />
              }
            />
          </dl>
        </section>
      </div>

      {/* The only controls in the admin that change an order, and the first
          thing anywhere that writes to `audit_logs`. Placed below the record
          rather than above it, so the page still reads as "here is the order"
          before it reads as "here is what you can do to it". */}
      <div className="mt-6">
        <OrderControls orderId={order.id} status={order.status} />
      </div>

      {order.notes && (
        <section className="mt-6 rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{order.notes}</p>
        </section>
      )}
    </div>
  );
}
