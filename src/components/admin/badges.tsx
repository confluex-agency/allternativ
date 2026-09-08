import type { OrderStatus, OrderEmailStatus } from "@/generated/prisma/enums";

// Status pills for the order book.
//
// Two separate statuses, shown separately and on purpose: an order is PAID
// whether or not its confirmation went out, and a mail provider having a bad
// afternoon must not be able to look like a payment problem. Anyone reading
// this screen on launch day needs to be able to tell those apart at a glance.

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {children}
    </span>
  );
}

const ORDER_TONES: Record<OrderStatus, string> = {
  // Unpaid. Not a problem in itself — a checkout that was opened and abandoned
  // looks exactly like this — so it is quiet rather than alarming.
  PENDING: "bg-neutral-100 text-neutral-600",
  PAID: "bg-emerald-50 text-emerald-700",
  PROCESSING: "bg-sky-50 text-sky-700",
  SHIPPED: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-neutral-100 text-neutral-600",
  CANCELLED: "bg-neutral-100 text-neutral-500",
  REFUNDED: "bg-amber-50 text-amber-700",
};

const EMAIL_TONES: Record<OrderEmailStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  SENT: "bg-emerald-50 text-emerald-700",
  // The only one that is genuinely bad news: the success page promised this
  // buyer a confirmation and they will never get one unless somebody writes.
  FAILED: "bg-red-50 text-red-700",
  SKIPPED: "bg-neutral-100 text-neutral-500",
};

/** Sentence case, so the table does not shout SHIPPED at the reader. */
function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Pill tone={ORDER_TONES[status]}>{label(status)}</Pill>;
}

export function EmailStatusBadge({ status }: { status: OrderEmailStatus }) {
  // "Pending" on its own reads like a queue that is working. It is, but only
  // while something drains it, so the word says what is being waited for.
  const text = status === "PENDING" ? "Queued" : label(status);
  return <Pill tone={EMAIL_TONES[status]}>{text}</Pill>;
}
