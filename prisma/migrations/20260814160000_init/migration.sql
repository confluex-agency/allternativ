-- CreateTable
CREATE TABLE `admin_users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ECOMMERCE_ADMIN', 'CONTENT_ADMIN', 'ANALYTICS_VIEWER') NOT NULL DEFAULT 'ANALYTICS_VIEWER',
    `must_change_password` BOOLEAN NOT NULL DEFAULT true,
    `password_changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `admin_user_id` VARCHAR(191) NULL,
    `admin_email` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NULL,
    `entity_label` VARCHAR(255) NULL,
    `old_value` JSON NULL,
    `new_value` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price_cents` INTEGER NOT NULL,
    `compare_at_price_cents` INTEGER NULL,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'HIDDEN', 'DISCONTINUED') NOT NULL DEFAULT 'DRAFT',
    `launch_date` DATETIME(3) NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `type` ENUM('OPTICAL', 'SUNGLASSES', 'BLUE_LIGHT', 'READING') NOT NULL,
    `frame_shape` ENUM('ROUND', 'SQUARE', 'AVIATOR', 'CAT_EYE', 'RECTANGLE', 'OVAL', 'BROWLINE', 'GEOMETRIC') NULL,
    `frame_material` ENUM('ACETATE', 'METAL', 'TITANIUM', 'TR90', 'WOOD', 'MIXED') NULL,
    `lens_type` VARCHAR(191) NULL,
    `frame_color` VARCHAR(191) NULL,
    `gender` ENUM('MEN', 'WOMEN', 'UNISEX') NOT NULL DEFAULT 'UNISEX',
    `feeling` TEXT NULL,
    `lens_material` VARCHAR(191) NULL,
    `uv_protection` VARCHAR(191) NULL,
    `lens_category` INTEGER NULL,
    `dimensions_mm` VARCHAR(191) NULL,
    `weight_grams` INTEGER NULL,
    `fit` VARCHAR(191) NULL,
    `meta_title` VARCHAR(191) NULL,
    `meta_description` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `color_key` VARCHAR(191) NOT NULL,
    `color_name` VARCHAR(191) NOT NULL,
    `swatch` VARCHAR(191) NULL,
    `price_cents` INTEGER NULL,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `supplier_sku` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_variants_sku_key`(`sku`),
    UNIQUE INDEX `product_variants_product_id_color_key_key`(`product_id`, `color_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_images` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `variant_id` VARCHAR(191) NULL,
    `url` VARCHAR(500) NOT NULL,
    `alt_text` VARCHAR(255) NULL,
    `type` ENUM('PRODUCT', 'MODEL', 'DETAIL', 'CASE', 'LIFESTYLE', 'PACKAGING') NOT NULL DEFAULT 'PRODUCT',
    `position` INTEGER NOT NULL DEFAULT 0,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collections` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `tagline` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `hero_image_url` VARCHAR(500) NULL,
    `hero_video_url` VARCHAR(500) NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `launch_date` DATETIME(3) NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `meta_title` VARCHAR(191) NULL,
    `meta_description` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `collections_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products_on_collections` (
    `product_id` VARCHAR(191) NOT NULL,
    `collection_id` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`product_id`, `collection_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `newsletter_subscribers` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED') NOT NULL DEFAULT 'PENDING',
    `source` VARCHAR(191) NULL,
    `consent_at` DATETIME(3) NULL,
    `consent_ip_hash` VARCHAR(191) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `unsubscribed_at` DATETIME(3) NULL,
    `unsubscribe_token` VARCHAR(191) NOT NULL,
    `discount_code` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `newsletter_subscribers_email_key`(`email`),
    UNIQUE INDEX `newsletter_subscribers_unsubscribe_token_key`(`unsubscribe_token`),
    INDEX `newsletter_subscribers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `stripe_customer_id` VARCHAR(191) NULL,
    `total_spent_cents` INTEGER NOT NULL DEFAULT 0,
    `order_count` INTEGER NOT NULL DEFAULT 0,
    `password_hash` VARCHAR(191) NULL,
    `email_verified_at` DATETIME(3) NULL,
    `marketing_consent` BOOLEAN NOT NULL DEFAULT false,
    `marketing_consent_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customers_email_key`(`email`),
    UNIQUE INDEX `customers_stripe_customer_id_key`(`stripe_customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `order_number` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `subtotal_cents` INTEGER NOT NULL,
    `shipping_cents` INTEGER NOT NULL DEFAULT 0,
    `tax_cents` INTEGER NOT NULL DEFAULT 0,
    `discount_cents` INTEGER NOT NULL DEFAULT 0,
    `promotion_code` VARCHAR(191) NULL,
    `total_cents` INTEGER NOT NULL,
    `refunded_cents` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `notes` TEXT NULL,
    `stripe_session_id` VARCHAR(191) NULL,
    `shipping_name` VARCHAR(191) NULL,
    `shipping_address` VARCHAR(255) NULL,
    `shipping_address_2` VARCHAR(255) NULL,
    `shipping_city` VARCHAR(191) NULL,
    `shipping_state` VARCHAR(191) NULL,
    `shipping_country` VARCHAR(191) NULL,
    `shipping_zip` VARCHAR(191) NULL,
    `shipping_phone` VARCHAR(191) NULL,
    `erp_exported_at` DATETIME(3) NULL,
    `tracking_number` VARCHAR(191) NULL,
    `carrier` VARCHAR(191) NULL,
    `shipped_at` DATETIME(3) NULL,
    `utm_source` VARCHAR(191) NULL,
    `utm_medium` VARCHAR(191) NULL,
    `utm_campaign` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_order_number_key`(`order_number`),
    UNIQUE INDEX `orders_stripe_session_id_key`(`stripe_session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `variant_id` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price_cents` INTEGER NOT NULL,
    `sku` VARCHAR(191) NULL,
    `product_name` VARCHAR(191) NULL,
    `variant_name` VARCHAR(191) NULL,
    `case_color` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wishlist_items` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wishlist_items_customer_id_product_id_key`(`customer_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `visitor_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NULL,
    `referrer` VARCHAR(500) NULL,
    `utm_source` VARCHAR(191) NULL,
    `utm_medium` VARCHAR(191) NULL,
    `utm_campaign` VARCHAR(191) NULL,
    `user_agent` VARCHAR(500) NULL,
    `device_type` VARCHAR(191) NULL,
    `browser` VARCHAR(191) NULL,
    `os` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `ip_hash` VARCHAR(191) NULL,
    `page_count` INTEGER NOT NULL DEFAULT 0,
    `duration_seconds` INTEGER NOT NULL DEFAULT 0,
    `landed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sessions_visitor_id_idx`(`visitor_id`),
    INDEX `sessions_landed_at_idx`(`landed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tracking_events` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `event_type` VARCHAR(191) NOT NULL,
    `page_path` VARCHAR(500) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NULL,

    INDEX `tracking_events_event_type_idx`(`event_type`),
    INDEX `tracking_events_timestamp_idx`(`timestamp`),
    INDEX `tracking_events_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_analytics` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `total_sessions` INTEGER NOT NULL DEFAULT 0,
    `unique_visitors` INTEGER NOT NULL DEFAULT 0,
    `page_views` INTEGER NOT NULL DEFAULT 0,
    `avg_session_duration` DOUBLE NOT NULL DEFAULT 0,
    `bounce_rate` DOUBLE NOT NULL DEFAULT 0,
    `total_orders` INTEGER NOT NULL DEFAULT 0,
    `total_revenue_cents` INTEGER NOT NULL DEFAULT 0,
    `conversion_rate` DOUBLE NOT NULL DEFAULT 0,
    `top_sources` JSON NULL,
    `top_countries` JSON NULL,
    `top_products_viewed` JSON NULL,
    `top_search_terms` JSON NULL,

    UNIQUE INDEX `daily_analytics_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products_on_collections` ADD CONSTRAINT `products_on_collections_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products_on_collections` ADD CONSTRAINT `products_on_collections_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wishlist_items` ADD CONSTRAINT `wishlist_items_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wishlist_items` ADD CONSTRAINT `wishlist_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tracking_events` ADD CONSTRAINT `tracking_events_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

