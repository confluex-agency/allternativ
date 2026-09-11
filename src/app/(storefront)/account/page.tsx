import type { Metadata } from "next";
import { requireCustomerPage } from "@/lib/customer-auth";
import { listCustomerOrders } from "@/lib/customer-accounts";
import { formatCurrency } from "@/lib/utils";
import { AccountView } from "@/components/storefront/account-view";

export const metadata: Metadata = {
  title: "Account",
  // The account is a private page; nothing here belongs in an index.
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const customer = await requireCustomerPage("/account");

  // Null when the address has not been proved. The distinction is carried all
  // the way to the screen rather than flattened into an empty list: "you have
  // not ordered anything" and "we are not showing you this yet" are different
  // sentences, and showing the wrong one would have somebody hunting for an
  // order they definitely placed.
  const orders = await listCustomerOrders(customer.id);

  return (
    <AccountView
      customer={customer}
      orders={
        orders?.map((order) => ({
          orderNumber: order.orderNumber,
          placedAt: order.placedAt.toISOString(),
          status: order.status,
          trackingNumber: order.trackingNumber,
          carrier: order.carrier,
          // Formatted here, on the server, where the order's own currency is
          // known. `formatCurrency` and never `formatPrice`: this sits beside a
          // card statement, and rounding EUR 15.10 to EUR 15 in a place people
          // reconcile against their bank is how a shop looks careless.
          total: formatCurrency(order.totalCents, order.currency),
          items: order.items.map((item) => ({
            label: [item.productName, item.variantName]
              .filter(Boolean)
              .join(" — "),
            caseColor: item.caseColor,
            quantity: item.quantity,
          })),
        })) ?? null
      }
    />
  );
}
