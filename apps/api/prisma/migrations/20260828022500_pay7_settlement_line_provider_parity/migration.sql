DROP INDEX IF EXISTS "OnlinePaymentSettlementLine_settlementBatchId_providerTransactionId_key";

CREATE UNIQUE INDEX
  "OnlinePaymentSettlementLine_batch_transaction_movement_key"
  ON "OnlinePaymentSettlementLine"(
    "settlementBatchId",
    "providerTransactionId",
    "movementType"
  );
