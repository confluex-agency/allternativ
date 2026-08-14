import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromCookies } from "@/lib/auth";
import { parseCsv } from "@/lib/erp/csv";
import { parseTrackingRows } from "@/lib/erp/dianxiaomi";

const ALLOWED_ROLES = new Set(["OWNER", "ECOMMERCE_ADMIN"]);
const MAX_BYTES = 2 * 1024 * 1024; // a tracking sheet is tiny; cap the parse

// Admin: upload the tracking sheet the supplier exports from Dianxiaomi.
// Accepts the raw CSV as the request body (text/csv) or a `file` field in a
// multipart form. Matched orders move to SHIPPED with their tracking number.
export async function POST(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED_ROLES.has(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let text: string;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Missing 'file' field" },
          { status: 400 },
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File too large" }, { status: 413 });
      }
      text = await file.text();
    } else {
      text = await request.text();
      if (text.length > MAX_BYTES) {
        return NextResponse.json({ error: "File too large" }, { status: 413 });
      }
    }
  } catch {
    return NextResponse.json({ error: "Could not read upload" }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const { updates, skipped } = parseTrackingRows(parseCsv(text));
  if (updates.length === 0) {
    return NextResponse.json(
      {
        error:
          "No usable rows. Expected columns for order number and tracking number.",
        skipped,
      },
      { status: 400 },
    );
  }

  const now = new Date();
  const updated: string[] = [];
  const notFound: string[] = [];

  for (const u of updates) {
    const result = await prisma.order.updateMany({
      where: { orderNumber: u.orderNumber },
      data: {
        trackingNumber: u.trackingNumber,
        carrier: u.carrier,
        shippedAt: now,
        status: "SHIPPED",
      },
    });
    if (result.count > 0) updated.push(u.orderNumber);
    else notFound.push(u.orderNumber);
  }

  return NextResponse.json({
    updated: updated.length,
    updatedOrders: updated,
    notFound,
    skipped,
  });
}
