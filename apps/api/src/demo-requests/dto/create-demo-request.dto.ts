import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateDemoRequestDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  businessName!: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  locationCount!: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsBoolean()
  consent!: boolean;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmSource?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmMedium?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmCampaign?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(0)
  website?: string;
}
