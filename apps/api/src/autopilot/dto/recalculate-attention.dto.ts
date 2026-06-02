import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecalculateAttentionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

