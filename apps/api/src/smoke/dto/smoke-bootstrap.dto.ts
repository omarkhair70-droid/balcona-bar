import { Type } from "class-transformer";
import {
  IsEmail,
  IsDefined,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";

export class SmokeBootstrapCredentialDto {
  @IsDefined()
  @IsEmail()
  email!: string;

  @IsDefined()
  @IsString()
  @MinLength(16)
  password!: string;
}

export class SmokeBootstrapCredentialsDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => SmokeBootstrapCredentialDto)
  owner!: SmokeBootstrapCredentialDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => SmokeBootstrapCredentialDto)
  cashier!: SmokeBootstrapCredentialDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => SmokeBootstrapCredentialDto)
  kitchen!: SmokeBootstrapCredentialDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => SmokeBootstrapCredentialDto)
  barista!: SmokeBootstrapCredentialDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => SmokeBootstrapCredentialDto)
  waiter!: SmokeBootstrapCredentialDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SmokeBootstrapCredentialDto)
  platform?: SmokeBootstrapCredentialDto;
}

export class SmokeBootstrapDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => SmokeBootstrapCredentialsDto)
  credentials!: SmokeBootstrapCredentialsDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
