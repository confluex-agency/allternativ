export type {
  AdminUser,
  Product,
  ProductImage,
  Category,
  Customer,
  Order,
  OrderItem,
  Session,
  TrackingEvent,
  DailyAnalytics,
} from "@/generated/prisma/client";

export type CartItem = {
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
  quantity: number;
  imageUrl: string;
};

export type TrackingEventPayload = {
  eventType: string;
  pagePath?: string;
  metadata?: Record<string, unknown>;
};
