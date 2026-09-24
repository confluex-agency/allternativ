"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { COMMERCIAL_ROLES, OWNER_ONLY, hasRole } from "@/lib/roles";

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
const navItems = [
  { href: "/admin", label: "Dashboard", icon: "◻", roles: null },
  // Orders carry the buyer's name, address and phone, so the page itself is
  // guarded by COMMERCIAL_ROLES. Listed here under the same rule rather than a
  // second copy of it: a link that bounces you back to the dashboard is a worse
  // way to learn you lack the role than not being offered it.
  { href: "/admin/orders", label: "Orders", icon: "◻", roles: COMMERCIAL_ROLES },
  // No customer data and no cost figures on this one, so any signed-in admin
  // may read it — including ANALYTICS_VIEWER, which is the default role.
  { href: "/admin/products", label: "Products", icon: "◻", roles: null },
  // Section 29. Every role, and therefore nothing customer-identifying on it.
  { href: "/admin/analytics", label: "Analytics", icon: "◻", roles: null },
  // Stock, prices and order changes, so the commercial roles; staff changes
  // inside it are OWNER-only (see audit-view.ts).
  // A code is a price cut, so the commercial roles.
  { href: "/admin/promotions", label: "Promotions", icon: "◻", roles: COMMERCIAL_ROLES },
  // What the shop pays and keeps: the commercial roles, never the viewers.
  { href: "/admin/finance", label: "Costs & margins", icon: "◻", roles: COMMERCIAL_ROLES },
  { href: "/admin/activity", label: "Activity", icon: "◻", roles: COMMERCIAL_ROLES },
  // ⚠️ OWNER only, and this is the one link where the narrower list is the
  // whole point: this screen decides who may use every other screen. An
  // ECOMMERCE_ADMIN who could reach it would simply invite themselves a second
  // account as OWNER, and the role system would be decoration.
  { href: "/admin/users", label: "People", icon: "◻", roles: OWNER_ONLY },
];

/** Screens the sidebar promised before they existed. Shown, not linked. */
const comingSoon = ["Customers"];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

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
        {navItems
          // Optimistic while the role is still being fetched. `user` comes from
          // /api/auth/me, so the first paint has no role at all — and hiding a
          // link for a beat, then popping it in, reads as the admin being
          // broken. The page enforces the rule regardless; this only decides
          // what is offered.
          .filter(
            (item) => !item.roles || loading || hasRole(user?.role, item.roles),
          )
          .map((item) => (
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
