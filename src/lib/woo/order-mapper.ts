// Translates our orders into the shape a WooCommerce client expects.
//
// The supplier's system reads WooCommerce JSON and nothing else, so this is a
// translation layer, not a second source of truth. Our database stays exactly as
// it is; only the wire format is WooCommerce's.

import type {
  Order,
  OrderItem,
  Customer,
  OrderStatus,
  Product,
} from "@/generated/prisma/client";
import { fulfilmentSku } from "@/lib/sku";

export type ExportableOrder = Order & {
  customer: Pick<Customer, "email" | "name" | "phone">;
  // The model code lives on the product, not on the line item snapshot, and the
  // packer wants it to cross-check against the invoice. Optional so an older
  // caller that only selected the items still type-checks and simply omits it.
  items: (OrderItem & { product?: Pick<Product, "code"> | null })[];
};

/**
 * Our status vocabulary is not WooCommerce's.
 *
 * `processing` is what WooCommerce calls a paid order waiting to be sent, which
 * is exactly what the supplier is looking for. `completed` means it has shipped.
 */
const STATUS_TO_WOO: Record<OrderStatus, string> = {
  PENDING: "pending",
  PAID: "processing",
  PROCESSING: "processing",
  SHIPPED: "completed",
  DELIVERED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

/** The reverse, for when the supplier updates an order. */
export const WOO_TO_STATUS: Record<string, OrderStatus> = {
  processing: "PROCESSING",
  // "Completed" from the supplier means dispatched, not delivered: they cannot
  // know that it arrived.
  completed: "SHIPPED",
  cancelled: "CANCELLED",
  refunded: "REFUNDED",
  "on-hold": "PROCESSING",
  failed: "CANCELLED",
};

export function wooStatus(status: OrderStatus): string {
  return STATUS_TO_WOO[status];
}

/** Cents to the decimal string WooCommerce uses. Never floats for money. */
function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function splitName(full: string | null): { first: string; last: string } {
  if (!full) return { first: "", last: "" };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

export function toWooOrder(order: ExportableOrder) {
  const name = splitName(order.shippingName ?? order.customer.name);

  const address = {
    first_name: name.first,
    last_name: name.last,
    company: "",
    address_1: order.shippingAddress ?? "",
    address_2: order.shippingAddress2 ?? "",
    city: order.shippingCity ?? "",
    state: order.shippingState ?? "",
    postcode: order.shippingZip ?? "",
    country: order.shippingCountry ?? "",
  };

  return {
    // WooCommerce's `id` is an integer and clients store it as one; `number` is
    // the human reference. Sending our cuid as `id` would break any client with
    // a numeric column, so each field gets the right kind of value.
    id: order.wooId,
    number: order.orderNumber,
    status: wooStatus(order.status),
    currency: order.currency,
    date_created: order.createdAt.toISOString(),
    date_modified: order.updatedAt.toISOString(),
    discount_total: money(order.discountCents),
    shipping_total: money(order.shippingCents),
    total: money(order.totalCents),
    billing: {
      ...address,
      email: order.customer.email,
      phone: order.shippingPhone ?? order.customer.phone ?? "",
    },
    shipping: {
      ...address,
      phone: order.shippingPhone ?? order.customer.phone ?? "",
    },
    line_items: order.items.map((item, index) => ({
      id: index + 1,
      // A plain hyphen, not an em dash: this string is read by a warehouse
      // system in another country and printed on a packing slip. Fancy
      // punctuation is an unnecessary bet on somebody else's encoding.
      name: [item.productName, item.variantName].filter(Boolean).join(" - "),
      // WooCommerce expects integers here and our ids are cuids. The SKU is
      // what identifies the item for the supplier anyway, so the numeric fields
      // are left at 0 and the real ids travel in meta_data, where they are
      // free-form and nothing tries to parse them.
      product_id: 0,
      variation_id: 0,
      quantity: item.quantity,
      // Daniel's format, `Model_Colour_Case`, assembled here because the case
      // colour is only known per line item. His warehouse reads this string and
      // decides which pair and which box leave the shelf, so it is the single
      // most load-bearing field in the whole payload.
      sku: fulfilmentSku(item.sku ?? "", item.caseColor),
      price: money(item.unitPriceCents),
      total: money(item.unitPriceCents * item.quantity),
      // The case colour is an option of the purchase, not a variant, so it has
      // nowhere else to go. WooCommerce shows meta_data on the packing slip,
      // which is exactly where the packer needs to see it.
      meta_data: [
        // Still sent as its own line even though it is now inside the SKU.
        // Daniel confirmed order and customer notes are displayed on his side,
        // and a packing slip that spells out "Case colour: WHITE" cannot be
        // misread the way a suffix on a long code can.
        ...(item.caseColor
          ? [{ key: "Case colour", value: item.caseColor }]
          : []),
        ...(item.product?.code
          ? [{ key: "Model code", value: item.product.code }]
          : []),
        { key: "_allternativ_product_id", value: item.productId },
        ...(item.variantId
          ? [{ key: "_allternativ_variant_id", value: item.variantId }]
          : []),
      ],
    })),
    meta_data: [
      { key: "_allternativ_order_id", value: order.id },
      ...(order.trackingNumber
        ? [{ key: "_tracking_number", value: order.trackingNumber }]
        : []),
      ...(order.carrier ? [{ key: "_tracking_provider", value: order.carrier }] : []),
    ],
  };
}

/**
 * Digs a tracking number out of whatever the supplier sends back.
 *
 * Each WooCommerce tracking plugin invents its own meta keys, and we do not know
 * which one they use until they use it, so several are accepted and the whole
 * body is logged either way.
 */
const TRACKING_KEYS = [
  "_tracking_number",
  "tracking_number",
  "_wot_tracking_number",
  "_wc_shipment_tracking_number",
  "trackingnumber",
];
const CARRIER_KEYS = [
  "_tracking_provider",
  "tracking_provider",
  "_wot_tracking_provider",
  "carrier",
  "shipping_company",
];

type MetaEntry = { key?: unknown; value?: unknown };

function readMeta(meta: unknown, wanted: string[]): string | null {
  if (!Array.isArray(meta)) return null;
  for (const entry of meta as MetaEntry[]) {
    if (typeof entry?.key !== "string") continue;
    const key = entry.key.toLowerCase();
    if (wanted.includes(key) && entry.value) return String(entry.value);
  }
  return null;
}

export function extractTracking(body: Record<string, unknown>): {
  trackingNumber: string | null;
  carrier: string | null;
} {
  const direct = (keys: string[]): string | null => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  };

  return {
    trackingNumber:
      direct(TRACKING_KEYS) ?? readMeta(body.meta_data, TRACKING_KEYS),
    carrier: direct(CARRIER_KEYS) ?? readMeta(body.meta_data, CARRIER_KEYS),
  };
}
