import type { Metadata } from "next";
import { NewsletterLinkAction } from "@/components/storefront/newsletter-link-action";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

// The privacy page promises every newsletter an unsubscribe link "that works
// immediately". This is where it points. One button, no sign-in, no reason
// asked: anything more is friction on the one action the law says must be as
// easy as signing up.
export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <NewsletterLinkAction mode="unsubscribe" token={token ?? null} />;
}
