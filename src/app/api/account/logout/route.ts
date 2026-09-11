import { NextResponse } from "next/server";
import { removeCustomerCookie } from "@/lib/customer-auth";

export async function POST() {
  await removeCustomerCookie();
  return NextResponse.json({ success: true });
}
