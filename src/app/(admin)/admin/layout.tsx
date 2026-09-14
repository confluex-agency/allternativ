"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // ⚠️ The signed-out pages get no sidebar, and this list has to match
  // `OPEN_ADMIN_PATHS` in `proxy.ts`. The sidebar calls `useAuth`, which asks
  // `/api/auth/me`; on a page reached WITHOUT a session that 401s, and somebody
  // resetting their password would watch a navigation they cannot use flicker
  // beside the form. Same reason the login page never had one.
  const SIGNED_OUT = [
    "/admin/login",
    "/admin/accept-invite",
    "/admin/forgot",
    "/admin/reset",
  ];
  if (SIGNED_OUT.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto bg-neutral-50 p-8">{children}</main>
    </div>
  );
}
