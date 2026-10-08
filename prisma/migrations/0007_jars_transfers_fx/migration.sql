-- CreateEnum
CREATE TYPE "FxSide" AS ENUM ('BUY', 'SELL');

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'BROKER';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "isReserved" BOOLEAN NOT NULL DEFAULT false;

-- "Відкладення" was the only set-aside account, found by name; it now carries the flag.
UPDATE "Account" SET "isReserved" = true WHERE "name" = 'Відкладення';

-- AlterTable: long-standing drift - the schema default has been 'light' since 0005.
ALTER TABLE "Settings" ALTER COLUMN "theme" SET DEFAULT 'light';

-- CreateTable
CREATE TABLE "FxTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT,
    "instrument" TEXT NOT NULL,
    "side" "FxSide" NOT NULL,
    "lots" DECIMAL(18,6),
    "openPrice" DECIMAL(18,8),
    "closePrice" DECIMAL(18,8),
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3) NOT NULL,
    "pnl" DECIMAL(18,6) NOT NULL,
    "commission" DECIMAL(18,6),
    "swap" DECIMAL(18,6),
    "setup" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FxTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FxTrade_userId_closedAt_idx" ON "FxTrade"("userId", "closedAt");

-- CreateIndex
CREATE INDEX "FxTrade_userId_instrument_idx" ON "FxTrade"("userId", "instrument");

-- CreateIndex
CREATE UNIQUE INDEX "FxTrade_userId_externalId_key" ON "FxTrade"("userId", "externalId");

-- AddForeignKey
ALTER TABLE "FxTrade" ADD CONSTRAINT "FxTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FxTrade" ADD CONSTRAINT "FxTrade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

