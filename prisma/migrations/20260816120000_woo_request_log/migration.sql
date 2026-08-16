-- CreateTable
CREATE TABLE `woo_request_logs` (
    `id` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `query` TEXT NULL,
    `body` TEXT NULL,
    `authenticated` BOOLEAN NOT NULL DEFAULT false,
    `matched` BOOLEAN NOT NULL DEFAULT false,
    `responseStatus` INTEGER NOT NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `woo_request_logs_created_at_idx`(`created_at`),
    INDEX `woo_request_logs_matched_idx`(`matched`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

