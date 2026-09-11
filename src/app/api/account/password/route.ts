import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CustomerPasswordSchema,
  passwordIsTooCloseToEmail,
  requireCustomer,
  signCustomerToken,
  setCustomerCookie,
} from "@/lib/customer-auth";
import { changeCustomerPassword } from "@/lib/customer-accounts";

const ChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: CustomerPasswordSchema,
});

export async function POST(request: NextRequest) {
  const auth = await requireCustomer();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }

  const parsed = ChangeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid password" },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "The new password has to be different" },
      { status: 400 },
    );
  }
  if (passwordIsTooCloseToEmail(newPassword, auth.customer.email)) {
    return NextResponse.json(
      { error: "Choose a password that is not your email address" },
      { status: 400 },
    );
  }

  const changed = await changeCustomerPassword(
    auth.customer.id,
    currentPassword,
    newPassword,
  );
  if (!changed) {
    return NextResponse.json(
      { error: "That is not your current password" },
      { status: 401 },
    );
  }

  // The change killed every token issued before it, including the one that
  // authorised this request. Re-issue, or the person is signed out by the act
  // of choosing a new password.
  const token = await signCustomerToken({
    sub: auth.customer.id,
    email: auth.customer.email,
  });
  await setCustomerCookie(token);

  return NextResponse.json({ success: true });
}
