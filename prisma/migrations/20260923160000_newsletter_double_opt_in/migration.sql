-- AlterTable
ALTER TABLE `newsletter_subscribers` ADD COLUMN `confirm_email_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `confirm_email_last_error` TEXT NULL,
    ADD COLUMN `confirm_email_sent_at` DATETIME(3) NULL,
    ADD COLUMN `confirm_email_status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'SKIPPED',
    ADD COLUMN `confirm_expires_at` DATETIME(3) NULL,
    ADD COLUMN `confirm_token` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `newsletter_subscribers_confirm_token_key` ON `newsletter_subscribers`(`confirm_token`);

-- CreateIndex
CREATE INDEX `newsletter_subscribers_confirm_email_status_idx` ON `newsletter_subscribers`(`confirm_email_status`);

