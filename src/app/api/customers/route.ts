import { NextRequest, NextResponse } from "next/server";
import { requireRole, COMMERCIAL_ROLES } from "@/lib/auth";
import { listCustomersForAdmin } from "@/lib/customers-admin";

// Same reasoning as orders: this is personal data, and a session alone was
// never the right bar for reading it.
//
// ⚠️ The query is NOT here any more. It named no columns, so it answered with
// the whole `Customer` row — hash, verification token and, from 2026-09-12, a
// live password reset token, which is a spendable credential rather than a
// disclosure. It moved to `src/lib/customers-admin.ts` so that what this route
// publishes is a decision written down in one place and held by a test, rather
// than whatever `Customer` happens to have columns for this week.

export async function GET(request: NextRequest) {
  const auth = await requireRole(...COMMERCIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)),
  );

  const { customers, total } = await listCustomersForAdmin({ page, pageSize });

  return NextResponse.json({ customers, total, page, pageSize });
}
