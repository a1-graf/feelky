-- CreateEnum
CREATE TYPE "PolySection" AS ENUM ('MANUAL', 'COPYTRADE', 'AI_AGENT');

-- CreateEnum
CREATE TYPE "PolyMarketKind" AS ENUM ('BTC_5M', 'BTC_15M', 'ETH_5M', 'ETH_15M', 'OTHER');

-- CreateEnum
CREATE TYPE "PolyTradeStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'VOID');

-- CreateEnum
CREATE TYPE "PolyLockStatus" AS ENUM ('LOCKED', 'RELEASED');

-- CreateTable
CREATE TABLE "PolyTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "section" "PolySection" NOT NULL,
    "agentName" TEXT,
    "walletRef" TEXT,
    "marketSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "marketKind" "PolyMarketKind" NOT NULL DEFAULT 'OTHER',
    "outcome" TEXT NOT NULL,
    "entryPrice" DECIMAL(18,8) NOT NULL,
    "sizeUsd" DECIMAL(18,6) NOT NULL,
    "shares" DECIMAL(18,8),
    "feesUsd" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "status" "PolyTradeStatus" NOT NULL DEFAULT 'OPEN',
    "pnlUsd" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "signalPrice" DECIMAL(18,8),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolyTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolyLock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "section" "PolySection" NOT NULL,
    "agentName" TEXT,
    "amountUsd" DECIMAL(18,6) NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "unlockAt" TIMESTAMP(3) NOT NULL,
    "status" "PolyLockStatus" NOT NULL DEFAULT 'LOCKED',
    "releasedAt" TIMESTAMP(3),
    "releasedAmountUsd" DECIMAL(18,6),
    "resultPnlUsd" DECIMAL(18,6),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolyLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolyTrade_userId_openedAt_idx" ON "PolyTrade"("userId", "openedAt");

-- CreateIndex
CREATE INDEX "PolyTrade_userId_section_idx" ON "PolyTrade"("userId", "section");

-- CreateIndex
CREATE INDEX "PolyTrade_userId_agentName_idx" ON "PolyTrade"("userId", "agentName");

-- CreateIndex
CREATE UNIQUE INDEX "PolyTrade_userId_externalId_key" ON "PolyTrade"("userId", "externalId");

-- CreateIndex
CREATE INDEX "PolyLock_userId_status_idx" ON "PolyLock"("userId", "status");

-- CreateIndex
CREATE INDEX "PolyLock_userId_agentName_idx" ON "PolyLock"("userId", "agentName");

-- AddForeignKey
ALTER TABLE "PolyTrade" ADD CONSTRAINT "PolyTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolyLock" ADD CONSTRAINT "PolyLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolyLock" ADD CONSTRAINT "PolyLock_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

