import type { Metadata } from "next";
import { AcceptInviteForm } from "@/components/admin/accept-invite-form";

export const metadata: Metadata = {
  title: "Set up your admin access",
  robots: { index: false, follow: false },
};

// ⚠️ One of the two /admin paths that is reachable without a session — see the
// list in `proxy.ts`. Somebody accepting an invitation has no cookie yet, which
// is the point of an invitation; guarding this would redirect them to a login
// form they cannot pass.
//
// ⚠️ The token is spent by a POST from the client, never by this page load. A
// link preview or a mail scanner opening the URL would burn an invitation that
// grants staff access, and the only recovery is an OWNER noticing and sending
// another. Same rule as the customer verify and reset pages.

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AcceptInviteForm token={token ?? null} />;
}
