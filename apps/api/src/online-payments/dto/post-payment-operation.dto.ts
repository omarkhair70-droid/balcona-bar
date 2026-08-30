import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class RefundOnlinePaymentDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsString()
  @MaxLength(120)
  idempotencyKey!: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class VoidOnlinePaymentDto {
  @IsString()
  @MaxLength(120)
  idempotencyKey!: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class CaptureOnlinePaymentDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsString()
  @MaxLength(120)
  idempotencyKey!: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}
