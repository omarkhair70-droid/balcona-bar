import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CancelBillDto {
  @IsOptional()
  @IsUUID()
  staffUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
