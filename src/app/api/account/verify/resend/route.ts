import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customer-auth";
import { reissueVerification } from "@/lib/customer-accounts";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const auth = await requireCustomer();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }

  const ip = getClientIp(request.headers);
  const { success } = await loginLimiter.limit(`resend:${ip}:${auth.customer.id}`);
  if (!success) {
    return NextResponse.json(
      { error: "Please wait a few minutes before asking again." },
      { status: 429 },
    );
  }

  const issued = await reissueVerification(auth.customer.id);

  // Null means there was nothing to issue — most often an address that is
  // already proved. Not an error, and worth saying plainly rather than
  // pretending a second email is on its way.
  return NextResponse.json({ queued: issued !== null });
}
