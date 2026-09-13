-- Admin invitations: so that granting access is something an OWNER does, and
-- not something a person does to themselves.
--
-- Until now there was exactly one way for an admin account to exist: the seed
-- made it. That is why there is only ever been one. Belu and Manuel needed
-- accounts, and the obvious-looking answer -- let them sign up -- is the one
-- thing that must never be built here: `AdminRole` defaults to
-- ANALYTICS_VIEWER, so self-registration would hand the dashboards to whoever
-- typed an email address.
--
-- ⚠️ `password_hash` becomes NULLABLE, and the null is load-bearing: it means
-- "invited, has not chosen a password yet". Every path that authenticates has
-- to read it that way, exactly as `customers.password_hash` null already means
-- "bought as a guest, never registered". Widening is safe for the rows that
-- exist -- all of them keep their hash -- and safe for the code already running,
-- which only ever reads the column.
--
-- ⚠️ `invite_email_status` defaults to SKIPPED for the same reason the other
-- three queues do. The rows that exist today were never invited; PENDING would
-- queue an invitation for an account that has been in use for weeks.
--
-- ⚠️ `is_active` rather than deleting. The audit trail freezes `admin_email` as
-- a string so it survives a delete, but a deleted row makes "who is this person
-- in the log" unanswerable -- and being able to ask that later is the entire
-- point of keeping the trail. Same rule as DISCONTINUED products.

-- AlterTable
ALTER TABLE `admin_users` ADD COLUMN `deactivated_at` DATETIME(3) NULL,
    ADD COLUMN `invite_email_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `invite_email_last_error` TEXT NULL,
    ADD COLUMN `invite_email_sent_at` DATETIME(3) NULL,
    ADD COLUMN `invite_email_status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'SKIPPED',
    ADD COLUMN `invite_expires_at` DATETIME(3) NULL,
    ADD COLUMN `invite_token` VARCHAR(191) NULL,
    ADD COLUMN `invited_by_email` VARCHAR(191) NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `password_hash` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `admin_users_invite_token_key` ON `admin_users`(`invite_token`);

-- CreateIndex
CREATE INDEX `admin_users_invite_email_status_idx` ON `admin_users`(`invite_email_status`);

