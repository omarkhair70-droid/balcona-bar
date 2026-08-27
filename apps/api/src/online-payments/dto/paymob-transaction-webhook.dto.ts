import { IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class PaymobTransactionWebhookQueryDto {
  @IsString()
  @MinLength(1)
  hmac!: string;
}

export class PaymobTransactionWebhookDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsObject()
  obj!: Record<string, unknown>;
}
