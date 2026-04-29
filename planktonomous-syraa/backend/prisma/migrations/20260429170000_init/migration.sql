-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('BUY', 'SELL', 'HOLD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION,
    "targetPrice" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "timeframe" TEXT NOT NULL,
    "indicators" JSONB NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "txSignature" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "token" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRequest" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "responseStatus" TEXT NOT NULL,
    "processingTimeMs" INTEGER NOT NULL,
    "signalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Signal_signalId_key" ON "Signal"("signalId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_signalId_key" ON "Payment"("signalId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_txSignature_key" ON "Payment"("txSignature");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRequest_signalId_key" ON "AgentRequest"("signalId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRequest" ADD CONSTRAINT "AgentRequest_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

