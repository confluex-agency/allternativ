-- AlterTable
ALTER TABLE `products` ADD COLUMN `code` VARCHAR(191) NULL,
    ADD COLUMN `frame_detail` VARCHAR(191) NULL,
    ADD COLUMN `origin` VARCHAR(191) NULL,
    ADD COLUMN `tagline` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `products_code_key` ON `products`(`code`);

