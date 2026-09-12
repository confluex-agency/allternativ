-- Self-service password reset: the last thing the ACCOUNT entry was missing.
--
-- Until now the login page said out loud that there was no reset, because a
-- reset needs a mail provider and nothing had been observed leaving. That
-- changed on 2026-09-11 (Resend accepted a confirmation) and again on
-- 2026-09-12 (it accepted a verification link too), so the reason to withhold
-- it is gone.
--
-- ⚠️ `reset_email_status` defaults to SKIPPED for the same reason
-- `verify_email_status` does, and the default matters on the first sweep after
-- this ships. Every row that exists today either bought as a guest or has an
-- account, and NONE of them has asked for a reset. PENDING would put all of
-- them in a queue for an email about a request nobody made — which is both a
-- mailshot and, read by a customer, an alarming one. SKIPPED is the honest
-- word: nothing was sent and nobody is going to.
--
-- `requestPasswordReset()` writes PENDING, and it is the only way into the
-- queue.
--
-- ⚠️ The columns are separate from the verification ones rather than shared.
-- A verification link can only mark an address proven; a reset link hands over
-- the account. Sharing one token column would let a link minted for the small
-- job be spent on the large one.

-- AlterTable
ALTER TABLE `customers` ADD COLUMN `password_reset_expires_at` DATETIME(3) NULL,
    ADD COLUMN `password_reset_token` VARCHAR(191) NULL,
    ADD COLUMN `reset_email_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `reset_email_last_error` TEXT NULL,
    ADD COLUMN `reset_email_sent_at` DATETIME(3) NULL,
    ADD COLUMN `reset_email_status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'SKIPPED';

-- CreateIndex
CREATE UNIQUE INDEX `customers_password_reset_token_key` ON `customers`(`password_reset_token`);

-- CreateIndex
CREATE INDEX `customers_reset_email_status_idx` ON `customers`(`reset_email_status`);

