ALTER TABLE "Settings" ADD COLUMN "monthlyExpenseLimit" DECIMAL(18,6) NOT NULL DEFAULT 40000;

UPDATE "Settings"
SET "monthlyExpenseLimit" = "yellowMax";

UPDATE "Settings"
SET "theme" = 'light'
WHERE "theme" IS NULL OR "theme" = 'system';
