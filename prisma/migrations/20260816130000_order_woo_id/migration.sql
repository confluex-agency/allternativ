-- AlterTable
-- Written by hand. Prisma generates the column and its index as two separate
-- statements, and MySQL rejects that: an AUTO_INCREMENT column must be defined
-- as a key in the SAME statement that adds it (error 1075). Combining them is
-- the whole fix.
ALTER TABLE `orders`
  ADD COLUMN `woo_id` INTEGER NOT NULL AUTO_INCREMENT,
  ADD UNIQUE INDEX `orders_woo_id_key`(`woo_id`);
