ALTER TABLE "ExpectedMoney" ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Заморожені бабки';

UPDATE "Account"
SET "name" = 'Мейн гаманець',
    "provider" = NULL,
    "type" = 'CRYPTO_WALLET'
WHERE "currency" = 'USDT'
  AND lower("name") = 'binance';

UPDATE "ExpectedStatusDefinition"
SET "label" = CASE "status"
  WHEN 'EXPECTED' THEN 'Заморожено'
  WHEN 'NEED_TO_COLLECT' THEN 'Потрібно забрати'
  WHEN 'IN_PROGRESS' THEN 'В процесі'
  WHEN 'RECEIVED' THEN 'Повернулось'
  WHEN 'LOST' THEN 'Втрачено'
  WHEN 'SCAMMED' THEN 'Скам'
  ELSE "label"
END;
