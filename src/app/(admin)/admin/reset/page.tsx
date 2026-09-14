import type { Metadata } from "next";
import { AcceptInviteForm } from "@/components/admin/accept-invite-form";

export const metadata: Metadata = {
  title: "Choose a new admin password",
  robots: { index: false, follow: false },
};

// ⚠️ The token is spent by a POST from the client, never by this page load —
// the rule every link-bearing page here follows, because a link preview or a
// corporate mail scanner would otherwise burn it before the person clicked.
//
// It reuses `AcceptInviteForm` with a different endpoint and different words.
// The two screens ask for exactly the same thing — a password, twice, against a
// token — and a second copy would be two places to fix the day the password
// rule changes.
export default async function AdminResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AcceptInviteForm token={token ?? null} mode="reset" />;
}
