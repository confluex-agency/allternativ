// ─── Dianxiaomi (店小秘) order hand-off ───────────────────────────────────────
//
// WHY A FILE EXPORT AND NOT AN API CALL
// Dianxiaomi has no open API for custom storefronts. It only authorises stores
// on platforms it has already integrated (Amazon, Shopee, Temu, TikTok Shop,
// eBay, Shopify, Shopline, Shoplazza, Shopyy, UEESHOP, WooCommerce…). A bespoke
// Next.js shop is not on that list, so paid orders leave the site as a file the
// supplier imports, and tracking numbers come back the same way.
//
// The next step (phase A) is a WooCommerce-compatible REST façade so Dianxiaomi
// can pull orders by itself. `buildErpRows` is the shared mapping layer: when
// the façade lands it feeds the same rows, so nothing here gets rewritten.
//
// ⚠️ COLUMN HEADERS ARE PROVISIONAL. Dianxiaomi's own import template ("万能
// 订单表格") is downloadable from inside an authenticated account and its
// headers are in Chinese. Once we have the real file, only `ERP_COLUMNS` below
// changes — the mapping and the routes stay as they are.

import type {
  Order,
  OrderItem,
  Customer,
  Product,
  ProductVariant,
} from "@/generated/prisma/client";

export type ErpOrder = Order & {
  customer: Pick<Customer, "email" | "name" | "phone">;
  items: (OrderItem & {
    product: Pick<Product, "name">;
    variant: Pick<ProductVariant, "sku" | "colorName" | "supplierSku"> | null;
  })[];
};

/** One flat line per order item — Dianxiaomi repeats the order number. */
export type ErpRow = {
  orderNumber: string;
  orderDate: string;
  status: string;
  sku: string;
  supplierSku: string;
  productName: string;
  variantName: string;
  caseColor: string;
  quantity: number;
  unitPrice: string;
  itemTotal: string;
  currency: string;
  recipientName: string;
  phone: string;
  email: string;
  country: string;
  state: string;
  city: string;
  address1: string;
  address2: string;
  zip: string;
  orderShipping: string;
  orderTotal: string;
};

/** Column order and headers of the exported file. Adapt to the real template. */
export const ERP_COLUMNS: { key: keyof ErpRow; header: string }[] = [
  { key: "orderNumber", header: "Order Number" },
  { key: "orderDate", header: "Order Date" },
  { key: "status", header: "Status" },
  { key: "sku", header: "SKU" },
  { key: "supplierSku", header: "Supplier SKU" },
  { key: "productName", header: "Product Name" },
  { key: "variantName", header: "Variant" },
  // The case is chosen at checkout and is not part of the SKU, so without this
  // column the supplier has no way of knowing which one to pack.
  { key: "caseColor", header: "Case Colour" },
  { key: "quantity", header: "Quantity" },
  { key: "unitPrice", header: "Unit Price" },
  { key: "itemTotal", header: "Item Total" },
  { key: "currency", header: "Currency" },
  { key: "recipientName", header: "Recipient Name" },
  { key: "phone", header: "Phone" },
  { key: "email", header: "Email" },
  { key: "country", header: "Country" },
  { key: "state", header: "State/Province" },
  { key: "city", header: "City" },
  { key: "address1", header: "Address Line 1" },
  { key: "address2", header: "Address Line 2" },
  { key: "zip", header: "Postcode" },
  { key: "orderShipping", header: "Order Shipping" },
  { key: "orderTotal", header: "Order Total" },
];

/** Cents → plain decimal string. Never use floats for money arithmetic. */
function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** YYYY-MM-DD HH:mm:ss in UTC — unambiguous for the supplier's timezone. */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function buildErpRows(orders: ErpOrder[]): ErpRow[] {
  return orders.flatMap((order) =>
    order.items.map((item) => ({
      orderNumber: order.orderNumber,
      orderDate: formatDate(order.createdAt),
      status: order.status,
      // Snapshots first: they are what the buyer actually paid for.
      sku: item.sku ?? item.variant?.sku ?? "",
      supplierSku: item.variant?.supplierSku ?? "",
      productName: item.productName ?? item.product.name,
      variantName: item.variantName ?? item.variant?.colorName ?? "",
      caseColor: item.caseColor ?? "",
      quantity: item.quantity,
      unitPrice: money(item.unitPriceCents),
      itemTotal: money(item.unitPriceCents * item.quantity),
      currency: order.currency,
      recipientName: order.shippingName ?? order.customer.name ?? "",
      phone: order.shippingPhone ?? order.customer.phone ?? "",
      email: order.customer.email,
      country: order.shippingCountry ?? "",
      state: order.shippingState ?? "",
      city: order.shippingCity ?? "",
      address1: order.shippingAddress ?? "",
      address2: order.shippingAddress2 ?? "",
      zip: order.shippingZip ?? "",
      orderShipping: money(order.shippingCents),
      orderTotal: money(order.totalCents),
    })),
  );
}

export const ERP_HEADERS = ERP_COLUMNS.map((c) => c.header);

export function erpRowsToCells(rows: ErpRow[]): (string | number)[][] {
  return rows.map((row) => ERP_COLUMNS.map((c) => row[c.key]));
}

// ─── Tracking coming back from the supplier ─────────────────────────────────

/**
 * Accepted header spellings for the tracking sheet, lowercased. The supplier
 * may send the file from Dianxiaomi (English or Chinese) or hand-typed, so we
 * match loosely instead of demanding one exact template.
 */
const TRACKING_ALIASES = {
  orderNumber: ["order number", "ordernumber", "order no", "order_no", "订单号"],
  trackingNumber: [
    "tracking number",
    "trackingnumber",
    "tracking no",
    "tracking",
    "运单号",
    "跟踪号",
  ],
  carrier: ["carrier", "shipping method", "logistics", "物流商", "运输方式"],
} as const;

function pick(row: Record<string, string>, aliases: readonly string[]): string {
  for (const [header, value] of Object.entries(row)) {
    if (aliases.includes(header.toLowerCase().trim())) return value;
  }
  return "";
}

export type TrackingUpdate = {
  orderNumber: string;
  trackingNumber: string;
  carrier: string | null;
};

export type TrackingParseResult = {
  updates: TrackingUpdate[];
  skipped: { row: number; reason: string }[];
};

export function parseTrackingRows(
  rows: Record<string, string>[],
): TrackingParseResult {
  const updates: TrackingUpdate[] = [];
  const skipped: { row: number; reason: string }[] = [];

  rows.forEach((row, i) => {
    const orderNumber = pick(row, TRACKING_ALIASES.orderNumber);
    const trackingNumber = pick(row, TRACKING_ALIASES.trackingNumber);
    const carrier = pick(row, TRACKING_ALIASES.carrier);

    if (!orderNumber) {
      skipped.push({ row: i + 2, reason: "no order number column/value" });
      return;
    }
    if (!trackingNumber) {
      skipped.push({ row: i + 2, reason: "no tracking number" });
      return;
    }
    // Same order repeated once per item: one tracking number per order is enough.
    if (updates.some((u) => u.orderNumber === orderNumber)) return;

    updates.push({ orderNumber, trackingNumber, carrier: carrier || null });
  });

  return { updates, skipped };
}
