-- CreateEnum
CREATE TYPE "ForkStatus" AS ENUM ('OPEN', 'SETTLED');

-- CreateTable
CREATE TABLE "ForkTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "ForkStatus" NOT NULL DEFAULT 'SETTLED',
    "placedAt" TIMESTAMP(3) NOT NULL,
    "sport" TEXT,
    "match" TEXT NOT NULL,
    "tags" TEXT[],
    "leg1Book" TEXT NOT NULL,
    "leg1Pick" TEXT NOT NULL,
    "leg1Odds" DECIMAL(10,4) NOT NULL,
    "leg1Stake" DECIMAL(18,6) NOT NULL,
    "leg2Book" TEXT NOT NULL,
    "leg2Pick" TEXT NOT NULL,
    "leg2Odds" DECIMAL(10,4) NOT NULL,
    "leg2Stake" DECIMAL(18,6) NOT NULL,
    "total" DECIMAL(18,6) NOT NULL,
    "pnl" DECIMAL(18,6),
    "guaranteed" DECIMAL(18,6),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForkTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForkTrade_userId_placedAt_idx" ON "ForkTrade"("userId", "placedAt");

-- CreateIndex
CREATE INDEX "ForkTrade_userId_status_idx" ON "ForkTrade"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ForkTrade_userId_externalId_key" ON "ForkTrade"("userId", "externalId");

-- AddForeignKey
ALTER TABLE "ForkTrade" ADD CONSTRAINT "ForkTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
