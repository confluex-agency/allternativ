export type {
  AdminUser,
  AuditLog,
  Product,
  ProductVariant,
  ProductImage,
  Collection,
  NewsletterSubscriber,
  Customer,
  Order,
  OrderItem,
  Session,
  TrackingEvent,
  DailyAnalytics,
} from "@/generated/prisma/client";

import type { CaseColor } from "@/lib/product-options";

/**
 * One line in the basket. Identified by `lineId` (variant + case colour), not by
 * product: the same model in two colours, or with two different cases, must sit
 * on separate lines. `variantId` is a real database id, which is what the
 * checkout prices against.
 */
export type CartItem = {
  lineId: string;
  variantId: string;
  productId: string;
  sku: string;
  /** Product name, e.g. "Orbital". */
  name: string;
  /** Colourway name, e.g. "Negro". */
  variantName: string;
  slug: string;
  caseColor: CaseColor;
  priceCents: number;
  quantity: number;
  imageUrl: string;
};

export type TrackingEventPayload = {
  eventType: string;
  pagePath?: string;
  metadata?: Record<string, unknown>;
};
