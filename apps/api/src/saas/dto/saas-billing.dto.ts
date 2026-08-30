import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class StartSaasBillingCheckoutDto {
  @IsString()
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @MaxLength(50)
  lastName!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MaxLength(40)
  @Matches(/^[+0-9][0-9 ()-]{6,39}$/)
  phoneNumber!: string;
}

export class ChangeSaasBillingPlanDto {
  @IsString()
  @MaxLength(80)
  planCode!: string;
}

export class CancelSaasBillingDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class PaymobSaasBillingWebhookQueryDto {
  @IsString()
  @MaxLength(256)
  hmac!: string;
}

export class PaymobSaasBillingWebhookDto {
  obj!: unknown;
}
