import { IsOptional, IsUUID } from 'class-validator';

export class CashierAcceptOrderDto {
  @IsOptional()
  @IsUUID('4')
  staffUserId?: string;
}
