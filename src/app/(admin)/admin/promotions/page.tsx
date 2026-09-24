import { requireAdminPage } from "@/lib/admin-guard";
import { COMMERCIAL_ROLES } from "@/lib/roles";
import { listPromotions, type PromotionRow } from "@/lib/promotions-admin";
import { CreatePromotion, PromotionToggle } from "@/components/admin/promotion-controls";

// Discount codes (sections 26 and 29). A screen over Stripe, not a copy of it:
// see `promotions-admin.ts` for why the codes are not kept in our own table.

export const dynamic = "force-dynamic";

function status(p: PromotionRow): { text: string; tone: string } {
  if (!p.active) return { text: "Off", tone: "text-neutral-400" };
  if (p.expiresAt && p.expiresAt.getTime() < Date.now()) {
    return { text: "Expired", tone: "text-neutral-400" };
  }
  if (p.maxRedemptions !== null && p.timesRedeemed >= p.maxRedemptions) {
    return { text: "Used up", tone: "text-neutral-400" };
  }
  return { text: "Live", tone: "text-green-700" };
}

export default async function AdminPromotionsPage() {
  await requireAdminPage(...COMMERCIAL_ROLES);

  // Stripe down is not the admin down: say so where the list would be.
  let codes: PromotionRow[] | null = null;
  try {
    codes = await listPromotions();
  } catch {
    codes = null;
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold">Promotions</h1>
      <p className="mt-1 max-w-2xl text-neutral-500">
        Codes live in Stripe and customers type them in the bag. The shop refuses a code on any
        basket it would sell below cost, whatever the code says, so a code can never lose money.
      </p>

      <div className="mt-6">
        <CreatePromotion />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Codes
      </h2>
      {codes === null ? (
        <p className="mt-3 rounded-lg border border-dashed bg-white p-5 text-sm text-red-700">
          Stripe did not answer, so the codes cannot be listed right now. Nothing is wrong with
          the codes themselves.
        </p>
      ) : codes.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed bg-white p-5 text-sm text-neutral-500">
          No codes yet.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Offer</th>
                <th className="px-4 py-3 text-right font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Ends</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {codes.map((p) => {
                const s = status(p);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono">{p.code}</td>
                    <td className="px-4 py-3">
                      {p.offer}
                      {p.firstOrderOnly && (
                        <span className="block text-xs text-neutral-400">first order only</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.timesRedeemed}
                      {p.maxRedemptions !== null && ` / ${p.maxRedemptions}`}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {p.expiresAt ? p.expiresAt.toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className={`px-4 py-3 font-medium ${s.tone}`}>{s.text}</td>
                    <td className="px-4 py-3 text-right">
                      <PromotionToggle id={p.id} active={p.active} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-neutral-500">
        What a code cost is on every order it was used on, and in Costs &amp; margins.
      </p>
    </div>
  );
}
