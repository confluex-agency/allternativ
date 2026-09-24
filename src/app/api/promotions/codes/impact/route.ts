import { NextRequest, NextResponse } from "next/server";
import { requireRole, COMMERCIAL_ROLES } from "@/lib/auth";
import { discountImpact } from "@/lib/promotions-admin";

// Which baskets a percentage would be refused on, asked before the code
// exists. Reads costs, so it sits behind the same roles as creating one.

export async function GET(request: NextRequest) {
  const auth = await requireRole(...COMMERCIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const percent = Number(request.nextUrl.searchParams.get("percent"));
  if (!Number.isInteger(percent) || percent < 1 || percent > 90) {
    return NextResponse.json({ error: "Between 1 and 90" }, { status: 400 });
  }
  return NextResponse.json({ markets: await discountImpact(percent) });
}
