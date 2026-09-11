import type { Metadata } from "next";
import { AccountVerify } from "@/components/storefront/account-verify";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

export default async function AccountVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // ⚠️ The token is spent by a POST from the client, not by this page load.
  //
  // A GET is what a link preview, a corporate mail scanner and a browser
  // prefetch all issue, and every one of them would burn the link before the
  // person ever clicked it — they would then arrive at "this link has already
  // been used" and have no way to tell that from an attack. It is the same
  // reason `/api/cron/*` is POST-only.
  return <AccountVerify token={token ?? null} />;
}
