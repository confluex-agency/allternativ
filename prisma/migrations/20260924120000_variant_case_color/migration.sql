-- The case colour becomes a fact of the colourway (Daniel, 2026-09-24).
-- Nullable: the seed fills it, and a variant nobody has described is refused
-- at the checkout rather than sold with a guessed case.
ALTER TABLE `product_variants` ADD COLUMN `case_color` VARCHAR(16) NULL;
