import type { Metadata } from "next";
import { NewsletterLinkAction } from "@/components/storefront/newsletter-link-action";

export const metadata: Metadata = {
  title: "Confirm your subscription",
  robots: { index: false, follow: false },
};

// The link from the confirmation mail lands here. It is spent by the button,
// not by this page load: see `NewsletterLinkAction`.
export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <NewsletterLinkAction mode="confirm" token={token ?? null} />;
}
