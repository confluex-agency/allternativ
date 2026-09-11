import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerFromCookies } from "@/lib/customer-auth";
import { AccountAuthForm } from "@/components/storefront/account-auth-form";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);

  if (await getCustomerFromCookies()) redirect(target);

  return <AccountAuthForm mode="register" next={target} />;
}
