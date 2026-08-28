import { Type } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

export class OnlinePaymentBillingDataDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(32)
  phoneNumber!: string;
}

export enum FawryHostedPaymentMethod {
  Card = "CARD",
  MobileWallet = "MWALLET",
  PayAtFawry = "PayAtFawry",
  Valu = "VALU",
}

export class CreateOnlinePaymentIntentDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerReturnUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnlinePaymentBillingDataDto)
  billingData?: OnlinePaymentBillingDataDto;

  @IsOptional()
  @IsEnum(FawryHostedPaymentMethod)
  fawryPaymentMethod?: FawryHostedPaymentMethod;
}
