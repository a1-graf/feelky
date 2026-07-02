CREATE TYPE "Currency" AS ENUM ('UAH', 'USDT', 'USD');
CREATE TYPE "AccountType" AS ENUM ('EXCHANGE', 'EXCHANGE_SUBACCOUNT', 'BANK_CARD', 'CASH', 'CRYPTO_WALLET', 'OTHER');
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'P2P_WITHDRAWAL', 'CASH_WITHDRAWAL', 'TRANSFER', 'MANUAL_ADJUSTMENT', 'EXPECTED_MONEY_RECEIVED', 'FUNDS_FROZEN', 'FUNDS_RELEASED');
CREATE TYPE "FrozenFundStatus" AS ENUM ('FROZEN', 'RELEASED', 'LOST');
CREATE TYPE "ExpectedMoneyStatus" AS ENUM ('EXPECTED', 'NEED_TO_COLLECT', 'IN_PROGRESS', 'RECEIVED', 'LOST', 'SCAMMED');
CREATE TYPE "RateMode" AS ENUM ('AUTO', 'P2P_AVERAGE', 'MANUAL');
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'CUSTOM');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "emailVerified" TIMESTAMP(3),
  "image" TEXT,
  "passwordHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AccountType" NOT NULL,
  "name" TEXT NOT NULL,
  "provider" TEXT,
  "currency" "Currency" NOT NULL,
  "initialBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "currentBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "note" TEXT,
  "parentAccountId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncomeSource" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IncomeSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL,
  "currency" "Currency" NOT NULL,
  "convertedAmount" DECIMAL(18,6),
  "convertedCurrency" "Currency",
  "exchangeRate" DECIMAL(18,6),
  "sourceAccountId" TEXT,
  "destinationAccountId" TEXT,
  "categoryId" TEXT,
  "incomeSourceId" TEXT,
  "note" TEXT,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FrozenFund" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL,
  "currency" "Currency" NOT NULL,
  "frozenDate" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "status" "FrozenFundStatus" NOT NULL DEFAULT 'FROZEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "FrozenFund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpectedMoney" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL,
  "currency" "Currency" NOT NULL,
  "status" "ExpectedMoneyStatus" NOT NULL DEFAULT 'EXPECTED',
  "note" TEXT,
  "expectedDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ExpectedMoney_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpectedStatusDefinition" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ExpectedMoneyStatus" NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ExpectedStatusDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BalanceHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "previousBalance" DECIMAL(18,6) NOT NULL,
  "newBalance" DECIMAL(18,6) NOT NULL,
  "difference" DECIMAL(18,6) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BalanceHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Settings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "baseDisplayCurrency" "Currency" NOT NULL DEFAULT 'USDT',
  "p2pSourceAccountId" TEXT,
  "p2pDestinationAccountId" TEXT,
  "expenseDefaultSourceId" TEXT,
  "cashExchangePlace" TEXT NOT NULL DEFAULT 'Cashalot',
  "rateMode" "RateMode" NOT NULL DEFAULT 'P2P_AVERAGE',
  "manualUahUsdtRate" DECIMAL(18,6),
  "greenMax" DECIMAL(18,6) NOT NULL DEFAULT 20000,
  "yellowMax" DECIMAL(18,6) NOT NULL DEFAULT 40000,
  "hideAmounts" BOOLEAN NOT NULL DEFAULT false,
  "theme" TEXT NOT NULL DEFAULT 'system',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldData" JSONB,
  "newData" JSONB,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL,
  "currency" "Currency" NOT NULL,
  "categoryId" TEXT NOT NULL,
  "sourceAccountId" TEXT NOT NULL,
  "frequency" "RecurringFrequency" NOT NULL,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "RecurringTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");
CREATE UNIQUE INDEX "IncomeSource_userId_name_key" ON "IncomeSource"("userId", "name");
CREATE UNIQUE INDEX "ExpectedStatusDefinition_userId_status_key" ON "ExpectedStatusDefinition"("userId", "status");
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");
CREATE INDEX "Account_userId_type_idx" ON "Account"("userId", "type");
CREATE INDEX "Account_userId_currency_idx" ON "Account"("userId", "currency");
CREATE INDEX "Transaction_userId_type_idx" ON "Transaction"("userId", "type");
CREATE INDEX "Transaction_userId_transactionDate_idx" ON "Transaction"("userId", "transactionDate");
CREATE INDEX "Transaction_userId_archivedAt_idx" ON "Transaction"("userId", "archivedAt");
CREATE INDEX "FrozenFund_userId_status_idx" ON "FrozenFund"("userId", "status");
CREATE INDEX "ExpectedMoney_userId_status_idx" ON "ExpectedMoney"("userId", "status");
CREATE INDEX "BalanceHistory_userId_accountId_idx" ON "BalanceHistory"("userId", "accountId");
CREATE INDEX "AuditLog_userId_entityType_entityId_idx" ON "AuditLog"("userId", "entityType", "entityId");
CREATE INDEX "RecurringTransaction_userId_isActive_idx" ON "RecurringTransaction"("userId", "isActive");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncomeSource" ADD CONSTRAINT "IncomeSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_incomeSourceId_fkey" FOREIGN KEY ("incomeSourceId") REFERENCES "IncomeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FrozenFund" ADD CONSTRAINT "FrozenFund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FrozenFund" ADD CONSTRAINT "FrozenFund_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpectedMoney" ADD CONSTRAINT "ExpectedMoney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpectedStatusDefinition" ADD CONSTRAINT "ExpectedStatusDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BalanceHistory" ADD CONSTRAINT "BalanceHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BalanceHistory" ADD CONSTRAINT "BalanceHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
