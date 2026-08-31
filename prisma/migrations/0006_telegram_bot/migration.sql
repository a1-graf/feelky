-- CreateTable
CREATE TABLE "TelegramSession" (
    "id" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT,
    "step" TEXT,
    "draft" JSONB,
    "lastCategoryId" TEXT,
    "lastIncomeSourceId" TEXT,
    "lastExpenseAccountId" TEXT,
    "lastIncomeAccountUah" TEXT,
    "lastIncomeAccountUsdt" TEXT,
    "lastIncomeAccountUsd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramUpdate" (
    "updateId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramUpdate_pkey" PRIMARY KEY ("updateId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSession_telegramUserId_key" ON "TelegramSession"("telegramUserId");

-- CreateIndex
CREATE INDEX "TelegramSession_userId_idx" ON "TelegramSession"("userId");

-- CreateIndex
CREATE INDEX "TelegramUpdate_createdAt_idx" ON "TelegramUpdate"("createdAt");

-- AddForeignKey
ALTER TABLE "TelegramSession" ADD CONSTRAINT "TelegramSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
