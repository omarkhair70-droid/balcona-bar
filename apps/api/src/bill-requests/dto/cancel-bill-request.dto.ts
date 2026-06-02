import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CancelBillRequestDto {
  @IsOptional()
  @IsUUID()
  staffUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
