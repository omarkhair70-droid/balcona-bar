import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpsertBranchMenuItemOverrideDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceOverrideMinor?: number | null;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number | null;
}
