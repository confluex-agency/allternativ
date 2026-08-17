import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-guard";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// This page did not exist, and the login page redirects here whenever an
// account still has `mustChangePassword`. The seeded admin therefore landed on
// a 404 and kept its initial password — which is exactly the blocker written
// down for the staging deploy. The API route was already implemented; only the
// screen was missing.

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const auth = await requireAdminPage();

  const user = await prisma.adminUser.findUnique({
    where: { id: auth.sub },
    select: { mustChangePassword: true },
  });

  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm forced={Boolean(user?.mustChangePassword)} />
        </CardContent>
      </Card>
    </div>
  );
}
