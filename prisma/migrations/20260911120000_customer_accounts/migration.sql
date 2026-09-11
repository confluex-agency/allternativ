-- Customer accounts: the ACCOUNT entry section 02 of the brief asks for.
--
-- `customers.password_hash` and `email_verified_at` were already here, waiting.
-- What this adds is everything around them: the proof that an address belongs
-- to whoever typed it, and the queue that sends that proof.
--
-- ⚠️ `verify_email_status` defaults to SKIPPED, NOT to PENDING, and the
-- difference matters on the first sweep after this ships. Every row that
-- already exists in this table was created by the Stripe webhook for a GUEST
-- buyer: there is no account, no password, and nothing to verify. PENDING
-- would put every past customer in a queue for an email inviting them to
-- confirm an account they never opened. SKIPPED is the honest word — nothing
-- was sent, and nobody is going to.
--
-- `registerCustomer()` writes PENDING, which is the only way into the queue.
--
-- ⚠️ `password_changed_at` is nullable, unlike the admin column it mirrors.
-- Most rows here are guests who have never had a password; NULL means "no
-- password has ever been set", and the token check reads it that way.

-- AlterTable
ALTER TABLE `customers` ADD COLUMN `email_verification_expires_at` DATETIME(3) NULL,
    ADD COLUMN `email_verification_token` VARCHAR(191) NULL,
    ADD COLUMN `last_login_at` DATETIME(3) NULL,
    ADD COLUMN `password_changed_at` DATETIME(3) NULL,
    ADD COLUMN `verify_email_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `verify_email_last_error` TEXT NULL,
    ADD COLUMN `verify_email_sent_at` DATETIME(3) NULL,
    ADD COLUMN `verify_email_status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'SKIPPED';

-- CreateIndex
CREATE UNIQUE INDEX `customers_email_verification_token_key` ON `customers`(`email_verification_token`);

-- CreateIndex
CREATE INDEX `customers_verify_email_status_idx` ON `customers`(`verify_email_status`);

