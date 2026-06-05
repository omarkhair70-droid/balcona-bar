import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const MOCK_ONLINE_PAYMENT_WEBHOOK_STATUSES = [
  "pending",
  "requires_action",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
] as const;

export class MockOnlinePaymentWebhookDto {
  @IsOptional()
  @IsUUID()
  intentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerIntentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerEventId?: string;

  @IsIn(MOCK_ONLINE_PAYMENT_WEBHOOK_STATUSES)
  status!: (typeof MOCK_ONLINE_PAYMENT_WEBHOOK_STATUSES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  @IsOptional()
  amountMinor?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  failureCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  failureMessage?: string;
}

export class FailOnlinePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  failureCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  failureMessage?: string;
}
