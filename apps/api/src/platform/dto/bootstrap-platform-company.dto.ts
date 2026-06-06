import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export const PLATFORM_PLAN_CODES = [
  "pilot",
  "starter",
  "growth",
  "enterprise",
] as const;

export const PLATFORM_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
] as const;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class BootstrapPlatformCompanyCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(slugPattern)
  slug!: string;
}

export class BootstrapPlatformCompanyOwnerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;
}

export class BootstrapPlatformCompanyBranchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(slugPattern)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string | null;
}

export class BootstrapPlatformCompanySubscriptionDto {
  @IsIn(PLATFORM_PLAN_CODES)
  planCode!: (typeof PLATFORM_PLAN_CODES)[number];

  @IsOptional()
  @IsIn(PLATFORM_SUBSCRIPTION_STATUSES)
  status?: (typeof PLATFORM_SUBSCRIPTION_STATUSES)[number];
}

export class BootstrapPlatformCompanyStarterTablesDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  floorLabel!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  tablePrefix!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  startNumber!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  count!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  seats!: number;
}

export class BootstrapPlatformCompanyDto {
  @ValidateNested()
  @Type(() => BootstrapPlatformCompanyCompanyDto)
  company!: BootstrapPlatformCompanyCompanyDto;

  @ValidateNested()
  @Type(() => BootstrapPlatformCompanyOwnerDto)
  owner!: BootstrapPlatformCompanyOwnerDto;

  @ValidateNested()
  @Type(() => BootstrapPlatformCompanyBranchDto)
  branch!: BootstrapPlatformCompanyBranchDto;

  @ValidateNested()
  @Type(() => BootstrapPlatformCompanySubscriptionDto)
  subscription!: BootstrapPlatformCompanySubscriptionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BootstrapPlatformCompanyStarterTablesDto)
  starterTables?: BootstrapPlatformCompanyStarterTablesDto;
}
