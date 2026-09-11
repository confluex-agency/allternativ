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

  // ⚠️ Enforcement is NOT here — `updateCustomerProfile` refuses to write a
  // name or phone onto an unproved row whatever this route does, and that is
  // deliberately the one place the rule lives. What this is for is telling the
  // truth to the caller.
  //
  // Without it the request answered 200 and quietly discarded the change,
  // which is the exact behaviour the form on the other side has a comment
  // criticising: something that looks accepted and is not. A 403 says what
  // happened. Consent is untouched by this — an unverified person must still
  // be able to decline marketing, so a body carrying only that is fine.
  const touchesIdentity =
    parsed.data.name !== undefined || parsed.data.phone !== undefined;
  if (touchesIdentity && !auth.customer.emailVerified) {
    return NextResponse.json(
      {
        error: "Confirm your email address before changing your details",
        needsVerification: true,
      },
      { status: 403 },
    );
  }

  await updateCustomerProfile(auth.customer.id, parsed.data);
  return NextResponse.json({ success: true });
}
