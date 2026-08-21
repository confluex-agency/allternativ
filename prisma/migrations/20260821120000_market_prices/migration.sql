-- Per-market prices (brief section 21, and the client's "regional pricing"
-- decision of 2026-08-20).
--
-- Hand-written rather than produced by `prisma migrate dev`. There is no shadow
-- database on shared hosting, so the workflow here is `migrate diff` into a file
-- a human reads, then `migrate deploy`. A previous migration was broken by
-- redirecting the diff's stdout together with its log line into the .sql; this
-- one is written out and read.
--
-- Additive only: nothing is dropped and `products.price_cents` stays as the
-- fallback for any market with no row.

CREATE TABLE `market_prices` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `market` VARCHAR(8) NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `price_cents` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `market_prices_market_idx`(`market`),
    UNIQUE INDEX `market_prices_product_id_market_key`(`product_id`, `market`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `market_prices`
    ADD CONSTRAINT `market_prices_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
