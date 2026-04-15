-- CreateTable
CREATE TABLE "P2PTransfer" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "fee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "recipientAmount" DECIMAL(19,4) NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "P2PTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "P2PTransfer_groupId_key" ON "P2PTransfer"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "P2PTransfer_senderId_idempotencyKey_key" ON "P2PTransfer"("senderId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "P2PTransfer_senderId_createdAt_idx" ON "P2PTransfer"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "P2PTransfer_recipientId_createdAt_idx" ON "P2PTransfer"("recipientId", "createdAt");

-- AddForeignKey
ALTER TABLE "P2PTransfer" ADD CONSTRAINT "P2PTransfer_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2PTransfer" ADD CONSTRAINT "P2PTransfer_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

