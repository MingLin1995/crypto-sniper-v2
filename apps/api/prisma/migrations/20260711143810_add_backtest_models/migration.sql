-- CreateTable
CREATE TABLE "BacktestJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "config" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacktestJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalKline" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "openTime" BIGINT NOT NULL,
    "open" DECIMAL(20,8) NOT NULL,
    "high" DECIMAL(20,8) NOT NULL,
    "low" DECIMAL(20,8) NOT NULL,
    "close" DECIMAL(20,8) NOT NULL,
    "volume" DECIMAL(30,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalKline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BacktestJob_userId_status_idx" ON "BacktestJob"("userId", "status");

-- CreateIndex
CREATE INDEX "BacktestJob_createdAt_idx" ON "BacktestJob"("createdAt");

-- CreateIndex
CREATE INDEX "HistoricalKline_symbol_interval_idx" ON "HistoricalKline"("symbol", "interval");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalKline_symbol_interval_openTime_key" ON "HistoricalKline"("symbol", "interval", "openTime");

-- AddForeignKey
ALTER TABLE "BacktestJob" ADD CONSTRAINT "BacktestJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
