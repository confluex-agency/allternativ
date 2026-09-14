import type { Metadata } from "next";
import { AdminForgotForm } from "@/components/admin/admin-forgot-form";

export const metadata: Metadata = {
  title: "Reset your admin password",
  robots: { index: false, follow: false },
};

// ⚠️ Reachable without a session — see the open list in `proxy.ts`. Somebody who
// cannot sign in is exactly who this is for.
export default function AdminForgotPage() {
  return <AdminForgotForm />;
}
