import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CancelPreparationTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;

  @IsOptional()
  @IsUUID('4')
  staffUserId?: string;
}
