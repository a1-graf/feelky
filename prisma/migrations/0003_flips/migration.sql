-- CreateTable
CREATE TABLE "Flip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setup" TEXT NOT NULL,
    "pnl" DECIMAL(18,6) NOT NULL,
    "tradeDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Flip_userId_tradeDate_idx" ON "Flip"("userId", "tradeDate");

-- CreateIndex
CREATE INDEX "Flip_userId_setup_idx" ON "Flip"("userId", "setup");

-- AddForeignKey
ALTER TABLE "Flip" ADD CONSTRAINT "Flip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
