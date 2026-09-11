import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerFromCookies } from "@/lib/customer-auth";
import { AccountAuthForm } from "@/components/storefront/account-auth-form";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);

  // Already signed in: a login form somebody has already passed reads as a
  // broken site. Same reasoning as `requireAdminPage` sending an admin back to
  // the dashboard rather than to the login page.
  if (await getCustomerFromCookies()) redirect(target);

  return <AccountAuthForm initialMode="login" next={target} />;
}
