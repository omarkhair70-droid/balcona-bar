import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateOnlinePaymentIntentDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerReturnUrl?: string;
}
