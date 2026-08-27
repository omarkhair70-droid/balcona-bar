-- Product PAY-1: add the explicit Paymob provider without removing
-- the legacy external placeholder. Existing mock/external rows remain valid.
ALTER TYPE "OnlinePaymentProvider" ADD VALUE IF NOT EXISTS 'paymob';
