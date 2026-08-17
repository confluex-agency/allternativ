-- AlterTable
ALTER TABLE `stock_reservations` ADD COLUMN `case_key` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `case_stock` (
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

