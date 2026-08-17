import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";

// Server component on purpose. The guard runs before anything renders, and it
// goes through the same check the API routes use, so a token that was killed by
// a password change cannot open this page either.
//
// It also means the greeting no longer needs useAuth(), which removes one of
// the two duplicate /api/auth/me requests this screen used to fire.

export default async function AdminDashboardPage() {
  const user = await requireAdminPage();

  // The figures below are still placeholders. They are wired up in the admin
  // phase; this round is about who is allowed in, not what they see.
  const cards = [
    { label: "Total Revenue", value: "—" },
    { label: "Orders", value: "—" },
    { label: "Visitors Today", value: "—" },
    { label: "Products", value: "—" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-neutral-500">Welcome back, {user.name}.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-neutral-400">
        Figures are not connected yet.
      </p>
    </div>
  );
}
