// The WooCommerce facade.
//
// The supplier's order system (Dianxiaomi) can only connect to shops it already
// integrates with, and WooCommerce is one of them. Rather than run a real
// WordPress alongside this app, with a second catalogue to keep in step and a
// second thing to keep patched, we answer the handful of WooCommerce endpoints
// it actually uses. Their own authorisation form is explicit that this route
// handles orders only and never publishes products, so the surface is small.
//
// Every request that arrives here is logged, INCLUDING the routes we have not
// implemented. Nobody knows exactly what Dianxiaomi asks for when it authorises
// a store; the log is how we find out instead of guessing.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateWooRequest,
  isWooConfigured,
  redactedQuery,
} from "@/lib/woo/auth";
import {
  toWooOrder,
  extractTracking,
  wooStatus,
  WOO_TO_STATUS,
} from "@/lib/woo/order-mapper";

/** Orders the supplier may see. An unpaid basket is nobody else's business. */
const VISIBLE_STATUSES = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
] as const;

const ORDER_INCLUDE = {
  customer: { select: { email: true, name: true, phone: true } },
  items: true,
} as const;

type Handled = { status: number; body: unknown };

async function log(
  request: NextRequest,
  segments: string[],
  body: string | null,
  authenticated: boolean,
  matched: boolean,
  responseStatus: number,
) {
  try {
    const url = new URL(request.url);
    await prisma.wooRequestLog.create({
      data: {
        method: request.method,
        path: `/wp-json/${segments.join("/")}`.slice(0, 500),
        query: redactedQuery(url)?.slice(0, 4000) ?? null,
        body: body?.slice(0, 8000) ?? null,
        authenticated,
        matched,
        responseStatus,
        userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      },
    });
  } catch {
    // Logging must never be the reason a request fails.
  }
}

async function handle(
  request: NextRequest,
  segments: string[],
  rawBody: string | null,
): Promise<Handled | null> {
  const url = new URL(request.url);
  const path = segments.join("/");

  // Discovery. Clients check this to confirm they are talking to WordPress.
  if (path === "" || path === "wc/v3") {
    return {
      status: 200,
      body: {
        name: "Allternativ",
        description: "Allternativ store",
        url: process.env.NEXT_PUBLIC_APP_URL ?? "",
        namespaces: ["wc/v3"],
      },
    };
  }

  if (request.method === "GET" && path === "wc/v3/system_status") {
    return {
      status: 200,
      body: {
        environment: { version: "8.0.0" },
        settings: { currency: "EUR" },
      },
    };
  }

  if (request.method === "GET" && path === "wc/v3/orders") {
    const statusParam = url.searchParams.get("status");
    const perPage = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("per_page") ?? 20) || 20),
    );
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const after = url.searchParams.get("after");

    // A status filter arrives in WooCommerce's vocabulary, so it is matched
    // against ours by translating each of ours and comparing.
    const statuses = statusParam
      ? VISIBLE_STATUSES.filter((s) => wooStatus(s) === statusParam)
      : VISIBLE_STATUSES;

    const where = {
      status: { in: [...statuses] },
      ...(after ? { createdAt: { gte: new Date(after) } } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: perPage,
        skip: (page - 1) * perPage,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      status: 200,
      body: orders.map(toWooOrder),
      // Pagination headers are added by the caller below.
      ...{ total, totalPages: Math.ceil(total / perPage) },
    } as Handled & { total: number; totalPages: number };
  }

  const orderMatch = /^wc\/v3\/orders\/([^/]+)$/.exec(path);
  if (orderMatch) {
    const reference = decodeURIComponent(orderMatch[1]);
    // Clients normally use the integer WooCommerce id, but our own order number
    // is accepted too so a human can check a specific order by hand.
    const numeric = /^\d+$/.test(reference) ? Number(reference) : null;
    const order = await prisma.order.findFirst({
      where: numeric !== null ? { wooId: numeric } : { orderNumber: reference },
      include: ORDER_INCLUDE,
    });

    if (!order || !VISIBLE_STATUSES.includes(order.status as never)) {
      return {
        status: 404,
        body: { code: "woocommerce_rest_shop_order_invalid_id", message: "Invalid ID." },
      };
    }

    if (request.method === "GET") {
      return { status: 200, body: toWooOrder(order) };
    }

    if (request.method === "PUT" || request.method === "POST") {
      const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
      const { trackingNumber, carrier } = extractTracking(body);
      const nextStatus =
        typeof body.status === "string" ? WOO_TO_STATUS[body.status] : undefined;

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(trackingNumber ? { trackingNumber } : {}),
          ...(carrier ? { carrier } : {}),
          // A tracking number means it left the warehouse, whatever status the
          // caller happened to send.
          ...(trackingNumber && !order.shippedAt
            ? { shippedAt: new Date(), status: nextStatus ?? "SHIPPED" }
            : {}),
        },
        include: ORDER_INCLUDE,
      });

      return { status: 200, body: toWooOrder(updated) };
    }
  }

  return null; // not implemented — logged, so we can see what was wanted
}

async function respond(request: NextRequest, segments: string[]) {
  const rawBody =
    request.method === "GET" || request.method === "HEAD"
      ? null
      : await request.text().catch(() => null);

  if (!isWooConfigured()) {
    await log(request, segments, rawBody, false, false, 503);
    return NextResponse.json(
      { code: "not_configured", message: "Store integration is not enabled." },
      { status: 503 },
    );
  }

  const authenticated = authenticateWooRequest(request);
  if (!authenticated) {
    await log(request, segments, rawBody, false, false, 401);
    return NextResponse.json(
      {
        code: "woocommerce_rest_authentication_error",
        message: "Consumer key or secret is invalid.",
        data: { status: 401 },
      },
      { status: 401 },
    );
  }

  let handled: (Handled & { total?: number; totalPages?: number }) | null = null;
  try {
    handled = await handle(request, segments, rawBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await log(request, segments, rawBody, true, true, 500);
    console.error(`[woo] ${request.method} /${segments.join("/")}: ${message}`);
    return NextResponse.json(
      { code: "internal_error", message: "Request failed." },
      { status: 500 },
    );
  }

  if (!handled) {
    await log(request, segments, rawBody, true, false, 404);
    return NextResponse.json(
      {
        code: "rest_no_route",
        message: "No route was found matching the URL and request method.",
        data: { status: 404 },
      },
      { status: 404 },
    );
  }

  await log(request, segments, rawBody, true, true, handled.status);

  const response = NextResponse.json(handled.body, { status: handled.status });
  if (handled.total !== undefined) {
    response.headers.set("X-WP-Total", String(handled.total));
    response.headers.set("X-WP-TotalPages", String(handled.totalPages ?? 1));
  }
  return response;
}

type Context = { params: Promise<{ path?: string[] }> };

async function segmentsOf(context: Context): Promise<string[]> {
  const { path } = await context.params;
  return path ?? [];
}

export async function GET(request: NextRequest, context: Context) {
  return respond(request, await segmentsOf(context));
}
export async function POST(request: NextRequest, context: Context) {
  return respond(request, await segmentsOf(context));
}
export async function PUT(request: NextRequest, context: Context) {
  return respond(request, await segmentsOf(context));
}
export async function PATCH(request: NextRequest, context: Context) {
  return respond(request, await segmentsOf(context));
}
export async function DELETE(request: NextRequest, context: Context) {
  return respond(request, await segmentsOf(context));
}
