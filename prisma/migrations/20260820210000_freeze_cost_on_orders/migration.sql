-- Freeze the cost side of a sale, the way the price side is already frozen.
--
-- An order records what was sold and what was paid, so the catalogue can change
-- afterwards without rewriting history. It did not record what any of it COST,
-- which means margin could only ever be worked out against today's supplier
-- prices. The first time the supplier raises one, every past order silently
-- reprices backwards.
--
-- All three columns are nullable or defaulted, so this applies to a table with
-- rows in it. Orders placed before today keep NULL and are simply excluded from
-- margin reporting rather than being guessed at.

-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `unit_cost_cents` INTEGER NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `payment_fee_cents` INTEGER NULL,
    ADD COLUMN `shipping_cost_cents` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `supplier_cost_usd_cents` INTEGER NULL;
