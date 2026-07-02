-- CreateEnum
CREATE TYPE "SteamResaleInvestmentStatus" AS ENUM ('ACTIVE', 'RETURNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SteamArbitrageRoundStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SteamArbitrageResidualStatus" AS ENUM ('OPEN', 'WITHDRAWN', 'LOST');

-- CreateTable
CREATE TABLE "SteamResaleAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "note" TEXT,
  "currentSoftwareBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "currency" "Currency" NOT NULL DEFAULT 'USDT',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "SteamResaleAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamResaleBalanceSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resaleAccountId" TEXT NOT NULL,
  "balance" DECIMAL(18,6) NOT NULL,
  "snapshotDate" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SteamResaleBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamResaleInvestment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resaleAccountId" TEXT NOT NULL,
  "sourceAccountId" TEXT NOT NULL,
  "externalAmount" DECIMAL(18,6) NOT NULL,
  "receivedSteamAmount" DECIMAL(18,6) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "note" TEXT,
  "status" "SteamResaleInvestmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SteamResaleInvestment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamResaleWithdrawal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resaleAccountId" TEXT NOT NULL,
  "destinationAccountId" TEXT NOT NULL,
  "transactionId" TEXT,
  "softwareAmountSpent" DECIMAL(18,6) NOT NULL,
  "amountReceived" DECIMAL(18,6) NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'USDT',
  "withdrawalDate" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "SteamResaleWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamArbitrageScheme" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "SteamArbitrageScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamArbitrageRound" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "schemeId" TEXT NOT NULL,
  "siteName" TEXT,
  "sourceAccountId" TEXT NOT NULL,
  "destinationAccountId" TEXT,
  "transactionId" TEXT,
  "investedAmount" DECIMAL(18,6) NOT NULL,
  "finalAmountReceived" DECIMAL(18,6),
  "remainingAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "status" "SteamArbitrageRoundStatus" NOT NULL DEFAULT 'ACTIVE',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "SteamArbitrageRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamArbitrageResidual" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL,
  "status" "SteamArbitrageResidualStatus" NOT NULL DEFAULT 'OPEN',
  "destinationAccountId" TEXT,
  "resolvedAmount" DECIMAL(18,6),
  "resolvedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SteamArbitrageResidual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamExpenseAllocation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expenseTransactionId" TEXT NOT NULL,
  "resalePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "arbitragePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "arbitrageRoundId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SteamExpenseAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SteamResaleAccount_userId_isActive_idx" ON "SteamResaleAccount"("userId", "isActive");
CREATE UNIQUE INDEX "SteamResaleBalanceSnapshot_resaleAccountId_snapshotDate_key" ON "SteamResaleBalanceSnapshot"("resaleAccountId", "snapshotDate");
CREATE INDEX "SteamResaleBalanceSnapshot_userId_snapshotDate_idx" ON "SteamResaleBalanceSnapshot"("userId", "snapshotDate");
CREATE INDEX "SteamResaleInvestment_userId_status_idx" ON "SteamResaleInvestment"("userId", "status");
CREATE INDEX "SteamResaleInvestment_sourceAccountId_idx" ON "SteamResaleInvestment"("sourceAccountId");
CREATE UNIQUE INDEX "SteamResaleWithdrawal_transactionId_key" ON "SteamResaleWithdrawal"("transactionId");
CREATE INDEX "SteamResaleWithdrawal_userId_withdrawalDate_idx" ON "SteamResaleWithdrawal"("userId", "withdrawalDate");
CREATE INDEX "SteamResaleWithdrawal_destinationAccountId_idx" ON "SteamResaleWithdrawal"("destinationAccountId");
CREATE UNIQUE INDEX "SteamArbitrageScheme_userId_name_key" ON "SteamArbitrageScheme"("userId", "name");
CREATE INDEX "SteamArbitrageScheme_userId_isActive_idx" ON "SteamArbitrageScheme"("userId", "isActive");
CREATE UNIQUE INDEX "SteamArbitrageRound_transactionId_key" ON "SteamArbitrageRound"("transactionId");
CREATE INDEX "SteamArbitrageRound_userId_status_idx" ON "SteamArbitrageRound"("userId", "status");
CREATE INDEX "SteamArbitrageRound_schemeId_idx" ON "SteamArbitrageRound"("schemeId");
CREATE INDEX "SteamArbitrageResidual_userId_status_idx" ON "SteamArbitrageResidual"("userId", "status");
CREATE INDEX "SteamArbitrageResidual_roundId_idx" ON "SteamArbitrageResidual"("roundId");
CREATE UNIQUE INDEX "SteamExpenseAllocation_expenseTransactionId_key" ON "SteamExpenseAllocation"("expenseTransactionId");
CREATE INDEX "SteamExpenseAllocation_userId_idx" ON "SteamExpenseAllocation"("userId");
CREATE INDEX "SteamExpenseAllocation_arbitrageRoundId_idx" ON "SteamExpenseAllocation"("arbitrageRoundId");

-- AddForeignKey
ALTER TABLE "SteamResaleAccount" ADD CONSTRAINT "SteamResaleAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamResaleBalanceSnapshot" ADD CONSTRAINT "SteamResaleBalanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamResaleBalanceSnapshot" ADD CONSTRAINT "SteamResaleBalanceSnapshot_resaleAccountId_fkey" FOREIGN KEY ("resaleAccountId") REFERENCES "SteamResaleAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamResaleInvestment" ADD CONSTRAINT "SteamResaleInvestment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamResaleInvestment" ADD CONSTRAINT "SteamResaleInvestment_resaleAccountId_fkey" FOREIGN KEY ("resaleAccountId") REFERENCES "SteamResaleAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SteamResaleInvestment" ADD CONSTRAINT "SteamResaleInvestment_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SteamResaleWithdrawal" ADD CONSTRAINT "SteamResaleWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamResaleWithdrawal" ADD CONSTRAINT "SteamResaleWithdrawal_resaleAccountId_fkey" FOREIGN KEY ("resaleAccountId") REFERENCES "SteamResaleAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SteamResaleWithdrawal" ADD CONSTRAINT "SteamResaleWithdrawal_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SteamResaleWithdrawal" ADD CONSTRAINT "SteamResaleWithdrawal_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SteamArbitrageScheme" ADD CONSTRAINT "SteamArbitrageScheme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamArbitrageRound" ADD CONSTRAINT "SteamArbitrageRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamArbitrageRound" ADD CONSTRAINT "SteamArbitrageRound_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "SteamArbitrageScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SteamArbitrageRound" ADD CONSTRAINT "SteamArbitrageRound_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SteamArbitrageRound" ADD CONSTRAINT "SteamArbitrageRound_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SteamArbitrageRound" ADD CONSTRAINT "SteamArbitrageRound_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SteamArbitrageResidual" ADD CONSTRAINT "SteamArbitrageResidual_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamArbitrageResidual" ADD CONSTRAINT "SteamArbitrageResidual_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "SteamArbitrageRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamArbitrageResidual" ADD CONSTRAINT "SteamArbitrageResidual_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SteamExpenseAllocation" ADD CONSTRAINT "SteamExpenseAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamExpenseAllocation" ADD CONSTRAINT "SteamExpenseAllocation_expenseTransactionId_fkey" FOREIGN KEY ("expenseTransactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamExpenseAllocation" ADD CONSTRAINT "SteamExpenseAllocation_arbitrageRoundId_fkey" FOREIGN KEY ("arbitrageRoundId") REFERENCES "SteamArbitrageRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
