import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-guard";
import { listAdminUsers } from "@/lib/admin-users";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";

// Who is staff. OWNER only.
//
// ⚠️ The role check is here as well as on both API routes, and it is not a
// duplicate of the same rule — it answers a different question. The routes stop
// a request; this stops a PAGE rendering, which matters because a server
// component serialises whatever it fetched into the HTML. A page that rendered
// the staff list for a CONTENT_ADMIN and merely hid the buttons would ship the
// list in view-source.
//
// `redirect` rather than a 403 screen: somebody who is signed in and lacks the
// role has nothing to do here, and the dashboard is where they belong.

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await requireAdminPage();
  if (user.role !== "OWNER") redirect("/admin");

  const users = await listAdminUsers();

  return (
    <div>
      <h1 className="text-2xl font-semibold">People</h1>
      <p className="mt-1 max-w-2xl text-neutral-500">
        Who can sign in to this admin, and what each of them may do. Access is
        given here and nowhere else — there is no sign-up.
      </p>

      <div className="mt-8">
        <AdminUsersPanel users={users} currentEmail={user.email} />
      </div>
    </div>
  );
}
