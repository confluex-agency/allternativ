-- The contact form, which until now was a mock that sent nothing.
--
-- A customer who pressed "Send" was told nothing and nothing arrived anywhere:
-- the form had no action, so the browser reloaded /contact with the message in
-- the query string and threw it away. On a shop that takes money, that is a
-- customer believing they asked something and nobody ever answering.
--
-- The row is the outbox, the same shape as the six queued mails: written
-- first, then sent, and retried by the sweep if sending fails. `email_status`
-- defaults to PENDING here, unlike the others, because the table is new and has
-- no history that a PENDING default could mail by surprise.
-- CreateTable
CREATE TABLE `contact_messages` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `topic` ENUM('GENERAL', 'CUSTOM', 'PRESS', 'STOCKIST') NOT NULL,
    `message` TEXT NOT NULL,
    `email_status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `email_sent_at` DATETIME(3) NULL,
    `email_attempts` INTEGER NOT NULL DEFAULT 0,
    `email_last_error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contact_messages_email_status_idx`(`email_status`),
    INDEX `contact_messages_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

