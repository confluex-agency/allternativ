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
  /**
   * The euro price, and the fallback for a line added before market pricing
   * existed. A basket persists in localStorage across deploys, so a line
   * written by yesterday's build has to keep rendering under today's.
   */
  priceCents: number;
  /**
   * Every market's price for this line, carried in the basket rather than
   * looked up again.
   *
   * A visitor can change where the parcel is going while the basket is open,
   * and the whole basket has to reprice. Storing one figure would leave a cart
   * quoting euros next to a product page quoting pounds. Optional because
   * baskets written before this existed do not have it.
   */
  prices?: Record<string, { currency: string; cents: number }>;
  quantity: number;
  imageUrl: string;
};

export type TrackingEventPayload = {
  eventType: string;
  pagePath?: string;
  metadata?: Record<string, unknown>;
};
