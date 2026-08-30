import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  PaymentTerminalEnvironment,
  PaymentTerminalProvider,
} from "@prisma/client";

export class UpsertPaymentTerminalDto {
  @IsEnum(PaymentTerminalProvider)
  provider!: PaymentTerminalProvider;

  @IsEnum(PaymentTerminalEnvironment)
  environment!: PaymentTerminalEnvironment;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  providerTerminalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  deviceReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  merchantReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  secretReference?: string;
}

export class StartTerminalPaymentRequestDto {
  @IsString()
  @MinLength(8)
  @MaxLength(180)
  terminalId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(180)
  idempotencyKey!: string;
}
