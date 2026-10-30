-- CreateTable
CREATE TABLE "ForkBonus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForkBonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForkBonus_userId_receivedAt_idx" ON "ForkBonus"("userId", "receivedAt");

-- AddForeignKey
ALTER TABLE "ForkBonus" ADD CONSTRAINT "ForkBonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
