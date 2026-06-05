import { Type } from 'class-transformer';
import {
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
} from 'class-validator';
import {
  BRANCH_STATUSES,
  COMPANY_STATUSES,
  ONBOARDING_STAFF_ROLES,
  READINESS_CHECK_STATUSES,
  SLUG_PATTERN,
} from './tenant-onboarding-values';

export class UpdateCompanyOnboardingProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @IsIn(COMPANY_STATUSES)
  status?: (typeof COMPANY_STATUSES)[number];
}

export class UpdateBranchOnboardingProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string | null;

  @IsOptional()
  @IsIn(BRANCH_STATUSES)
  status?: (typeof BRANCH_STATUSES)[number];
}

export class CreateOnboardingFloorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class BulkCreateOnboardingTablesDto {
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

export class InviteOnboardingStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsIn(ONBOARDING_STAFF_ROLES)
  role!: (typeof ONBOARDING_STAFF_ROLES)[number];
}

export class UpdateReadinessCheckDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  key!: string;

  @IsIn(READINESS_CHECK_STATUSES)
  status!: (typeof READINESS_CHECK_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
