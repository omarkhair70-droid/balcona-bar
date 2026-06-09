-- Accelerates KDS ticket sequence generation inside cashier accept.
CREATE INDEX "KitchenTicket_branchId_sequence_idx" ON "KitchenTicket"("branchId", "sequence");
