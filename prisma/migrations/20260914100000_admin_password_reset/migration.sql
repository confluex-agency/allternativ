-- A way back in for an admin who forgot their password.
--
-- ⚠️ This closes a hole that shipping invitations on 2026-09-13 opened, and the
-- shape of it is worth writing down because it was invisible from inside the
-- feature that caused it.
--
-- `/api/auth` only ever had `change-password`, which requires being signed in.
-- That was survivable while the single admin account was created by the seed
-- and its password lived in somebody's manager. Invitations changed the picture
-- without changing that route: now there are several people with their own
-- accounts, and `inviteAdminUser` REFUSES an address that already exists -- so
-- an OWNER could not even re-send a link. An admin who forgot their password
-- was locked out permanently, and the only recovery was SQL against production
-- run by hand.
--
-- The client brief asks for it in as many words, in the same section 18 list
-- that asked for individual accounts and for add/remove: "Password reset and
-- appropriate authentication/security controls."
--
-- ⚠️ SEPARATE columns from the invitation, even though both flows end in "set a
-- password through an emailed link". An invitation goes to a row whose
-- `password_hash` is null and says "you now have access"; a reset goes to an
-- account that already works and says "choose a new one". The sweep's two
-- queues are told apart by exactly that, and the two messages say opposite
-- things -- so one token serving both would let the wrong message carry the
-- wrong meaning.
--
-- ⚠️ `reset_email_status` defaults to SKIPPED, like every other queue here.
-- Nobody has asked for a reset, and PENDING would mail every existing admin a
-- link about a request they never made.

-- AlterTable
ALTER TABLE `admin_users` ADD COLUMN `password_reset_expires_at` DATETIME(3) NULL,
    ADD COLUMN `password_reset_token` VARCHAR(191) NULL,
    ADD COLUMN `reset_email_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `reset_email_last_error` TEXT NULL,
    ADD COLUMN `reset_email_sent_at` DATETIME(3) NULL,
    ADD COLUMN `reset_email_status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'SKIPPED';

-- CreateIndex
CREATE UNIQUE INDEX `admin_users_password_reset_token_key` ON `admin_users`(`password_reset_token`);

-- CreateIndex
CREATE INDEX `admin_users_reset_email_status_idx` ON `admin_users`(`reset_email_status`);

