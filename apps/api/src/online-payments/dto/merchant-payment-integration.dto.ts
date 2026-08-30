import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  MerchantPaymentIntegrationEnvironment,
  MerchantPaymentIntegrationStatus,
  OnlinePaymentProvider,
} from "@prisma/client";

const CONFIGURABLE_PAYMENT_PROVIDERS = [
  OnlinePaymentProvider.paymob,
  OnlinePaymentProvider.fawry,
  OnlinePaymentProvider.maestr,
  OnlinePaymentProvider.external,
] as const;

export class UpsertMerchantPaymentIntegrationDto {
  @IsIn(["company", "branch"])
  scope!: "company" | "branch";

  @IsEnum(OnlinePaymentProvider)
  @IsIn(CONFIGURABLE_PAYMENT_PROVIDERS)
  provider!: OnlinePaymentProvider;

  @IsEnum(MerchantPaymentIntegrationEnvironment)
  environment!: MerchantPaymentIntegrationEnvironment;

  @IsEnum(MerchantPaymentIntegrationStatus)
  status!: MerchantPaymentIntegrationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  priority?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  merchantAccountReference?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  enabledChannels!: string[];

  @IsOptional()
  @IsObject()
  configurationMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  secretReferences?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readinessMessage?: string;

  @IsBoolean()
  webhookConfigured!: boolean;

  @IsBoolean()
  recoveryReady!: boolean;

  @IsBoolean()
  settlementConfigured!: boolean;
}
