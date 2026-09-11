import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customer-auth";

export async function GET() {
  const auth = await requireCustomer();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }
  return NextResponse.json({ customer: auth.customer });
}
