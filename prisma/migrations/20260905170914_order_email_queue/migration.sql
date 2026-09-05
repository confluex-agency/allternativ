-- The confirmation email becomes a queue instead of an inline send.
--
-- The order is written synchronously by the webhook; the mail is drained later
-- by scripts/sweep-orders.ts. A mail provider having a bad afternoon must never
-- be able to make Stripe retry a payment that already succeeded.

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `email_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `email_last_error` TEXT NULL,
    ADD COLUMN `email_sent_at` DATETIME(3) NULL,
    ADD COLUMN `email_status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `orders_email_status_idx` ON `orders`(`email_status`);

-- ⚠️ Every order that already exists predates the queue, so it is SKIPPED and
-- not PENDING. The default above would otherwise hand the sweep a backlog of
-- historical orders and mail every one of their buyers a confirmation for a
-- purchase they made weeks ago, the first time the script runs after deploy.
--
-- SKIPPED rather than SENT because nothing was sent: the column should not
-- claim an email that never left.
UPDATE `orders` SET `email_status` = 'SKIPPED' WHERE `email_status` = 'PENDING';
