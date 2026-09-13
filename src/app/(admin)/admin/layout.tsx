"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // ⚠️ The two signed-out pages get no sidebar, and the list has to match the
  // one in `proxy.ts`. The sidebar calls `useAuth`, which asks `/api/auth/me`;
  // on a page reached WITHOUT a session that request 401s, and the person
  // accepting an invitation would watch a navigation they cannot use flicker
  // beside the form. Same reason the login page never had one.
  if (pathname === "/admin/login" || pathname === "/admin/accept-invite") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto bg-neutral-50 p-8">{children}</main>
    </div>
  );
}
