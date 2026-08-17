import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, COMMERCIAL_ROLES } from "@/lib/auth";
import { toCsv } from "@/lib/erp/csv";
import {
  buildErpRows,
  erpRowsToCells,
  ERP_HEADERS,
  type ErpOrder,
} from "@/lib/erp/dianxiaomi";


const QuerySchema = z.object({
  // Which orders to hand to the supplier. PAID is the normal case.
  status: z
    .enum(["PAID", "PROCESSING", "PENDING", "SHIPPED"])
    .default("PAID"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  // By default we only send orders never exported before, so re-running the
  // export doesn't make the supplier ship the same order twice.
  includeExported: z.enum(["true", "false"]).default("false"),
  // Preview without stamping erpExportedAt.
  dryRun: z.enum(["true", "false"]).default("false"),
});

// Admin: download paid orders as a CSV for the supplier's Dianxiaomi import.
export async function GET(request: NextRequest) {
  const auth = await requireRole(...COMMERCIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const parsed = QuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { status, from, to, includeExported, dryRun } = parsed.data;

  const orders = (await prisma.order.findMany({
    where: {
      status,
      ...(includeExported === "true" ? {} : { erpExportedAt: null }),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    include: {
      customer: { select: { email: true, name: true, phone: true } },
      items: {
        include: {
          product: { select: { name: true } },
          variant: {
            select: { sku: true, colorName: true, supplierSku: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })) as ErpOrder[];

  const rows = buildErpRows(orders);
  const csv = toCsv(ERP_HEADERS, erpRowsToCells(rows));

  // Stamp only after the file is built, so a mapping error never marks orders
  // as sent. An empty result is not stamped either.
  if (dryRun === "false" && orders.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { erpExportedAt: new Date() },
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="allternativ-orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
      "X-Order-Count": String(orders.length),
      "X-Row-Count": String(rows.length),
    },
  });
}
