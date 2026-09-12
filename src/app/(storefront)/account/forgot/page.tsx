import type { Metadata } from "next";
import { AccountForgotForm } from "@/components/storefront/account-forgot-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function AccountForgotPage() {
  return <AccountForgotForm />;
}
