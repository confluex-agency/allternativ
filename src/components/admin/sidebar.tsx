"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// ⚠️ Only routes that EXIST belong here.
//
// This list carried Products, Orders, Customers and Analytics from the day the
// shell was scaffolded, and none of those pages was ever built. Every one of
// them is a 404. Nobody noticed because the admin is only opened by us, and we
// know — but the people it is for are the two founders, and the first thing
// they will do on launch day is log in and click "Orders".
//
// A link that goes nowhere is worse than a missing link: it says the feature is
// there and broken, rather than not there yet. The section below says what is
// true instead, and each entry moves up as its page ships. See "Admin roles" and
// the API routes in CLAUDE.md — `/api/orders` and `/api/customers` already exist
// and are role-checked; what is missing is the screen, not the data.
const navItems = [{ href: "/admin", label: "Dashboard", icon: "◻" }];

/** Screens the sidebar promised before they existed. Shown, not linked. */
const comingSoon = ["Products", "Orders", "Customers", "Analytics"];

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

        <p className="px-3 pt-6 pb-2 text-[10px] uppercase tracking-[0.12em] text-neutral-400">
          Not built yet
        </p>
        {comingSoon.map((label) => (
          <span
            key={label}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-300"
          >
            <span className="text-xs">◻</span>
            {label}
          </span>
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
