"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "◻" },
  { href: "/admin/products", label: "Products", icon: "◻" },
  { href: "/admin/orders", label: "Orders", icon: "◻" },
  { href: "/admin/customers", label: "Customers", icon: "◻" },
  { href: "/admin/analytics", label: "Analytics", icon: "◻" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 border-r bg-white flex flex-col">
      <div className="px-6 py-5 border-b">
        <Link
          href="/admin"
          className="text-lg font-light tracking-[0.15em] uppercase"
        >
          Allternativ
        </Link>
        <p className="text-xs text-neutral-400 mt-0.5">Admin</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
              pathname === item.href
                ? "bg-neutral-100 text-black font-medium"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-black"
            )}
          >
            <span className="text-xs">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-neutral-400 hover:text-red-600 transition-colors flex-shrink-0"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
