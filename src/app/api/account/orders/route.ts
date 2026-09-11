import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customer-auth";
import { listCustomerOrders } from "@/lib/customer-accounts";

export async function GET() {
  const auth = await requireCustomer();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }

  // Null means the address has not been proved. It is a 403 and not an empty
  // list, because "you have no orders" and "we are not showing you your
  // orders" are different things and the page says different words for them.
  //
  // The check itself lives in `listCustomerOrders`, not here. One copy of the
  // rule that makes this feature safe, for the reason the admin side learned
  // the hard way when a role check was left to each route to remember.
  const orders = await listCustomerOrders(auth.customer.id);
  if (orders === null) {
    return NextResponse.json(
      { error: "Confirm your email address first", needsVerification: true },
      { status: 403 },
    );
  }

  return NextResponse.json({ orders });
}
