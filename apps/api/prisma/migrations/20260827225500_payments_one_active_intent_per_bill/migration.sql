-- PAY-3: database-level invariant for customer bill payment creation.
-- Advisory locks serialize the normal code path. This partial unique index is the
-- final protection if another code path or another API instance attempts to
-- create a second active intent for the same bill.
--
-- Deployment intentionally fails if historical duplicate active intents exist;
-- those rows require explicit financial reconciliation rather than silent cleanup.
CREATE UNIQUE INDEX "OnlinePaymentIntent_one_active_per_bill_key"
ON "OnlinePaymentIntent" ("billId")
WHERE "status" IN ('pending', 'requires_action');
