import { SetMetadata } from "@nestjs/common";

export const PAYMENT_RATE_LIMIT_POLICY = "payment_rate_limit_policy";

export type PaymentRateLimitPolicy = "customer_create" | "customer_read";

export const PaymentRateLimit = (policy: PaymentRateLimitPolicy) =>
  SetMetadata(PAYMENT_RATE_LIMIT_POLICY, policy);
