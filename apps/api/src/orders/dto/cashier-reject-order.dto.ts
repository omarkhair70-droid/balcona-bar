import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CashierRejectOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;

  @IsOptional()
  @IsUUID('4')
  staffUserId?: string;
}
