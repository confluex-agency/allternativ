import type { Metadata } from "next";
import { AccountResetForm } from "@/components/storefront/account-reset-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function AccountResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // ⚠️ The token is spent by a POST from the client, not by this page load —
  // see the note in the component, and the same note on the verify page. A
  // reset link burnt by a mail scanner cannot be re-issued: the person has to
  // start the whole flow again, having done nothing wrong.
  //
  // ⚠️ Not signed-in-guarded either, and deliberately. Somebody resetting a
  // password is by definition unable to sign in, and a guard here would send
  // them to the login form the link exists to rescue them from.
  return <AccountResetForm token={token ?? null} />;
}
