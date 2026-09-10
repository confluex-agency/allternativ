-- The dispatch notification becomes a queue of its own.
--
-- The client asked for it on 2026-08-20 ("el cliente recibirá un Tracking ID"),
-- and the confirmation email has been promising it since it was written: "We'll
-- email you again with tracking as soon as it ships." Nothing sent it.
--
-- Counted separately from the confirmation rather than reusing those columns:
-- an order gets two emails, they fail independently, and one of them failing
-- must not describe the other.

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `dispatch_email_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `dispatch_email_last_error` TEXT NULL,
    ADD COLUMN `dispatch_email_sent_at` DATETIME(3) NULL,
    ADD COLUMN `dispatch_email_status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `orders_dispatch_email_status_idx` ON `orders`(`dispatch_email_status`);

-- ⚠️ Anything ALREADY SHIPPED predates this queue, so it is SKIPPED and not
-- PENDING. The default above would otherwise tell every past buyer that their
-- order "has just shipped" — weeks late — the first time the sweep ran.
--
-- Orders that have NOT shipped keep the PENDING default on purpose: their
-- dispatch email has not been missed, it has not happened yet.
--
-- SKIPPED rather than SENT because nothing was sent: the column must not claim
-- an email that never left.
UPDATE `orders`
   SET `dispatch_email_status` = 'SKIPPED'
 WHERE `status` IN ('SHIPPED', 'DELIVERED')
    OR `shipped_at` IS NOT NULL;
