import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/customer-auth";
import { updateCustomerProfile } from "@/lib/customer-accounts";

// ⚠️ No `email` here, and that is not an oversight. The address is the key the
// Stripe webhook matches orders on, so changing it silently either hands this
// account somebody else's history or loses its own. Doing it properly means
// proving the new address before the old one stops working — a flow of its
// own, not a field in this form.
const ProfileSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  marketingConsent: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const auth = await requireCustomer();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }

  const parsed = ProfileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid details" }, { status: 400 });
  }

  await updateCustomerProfile(auth.customer.id, parsed.data);
  return NextResponse.json({ success: true });
}
