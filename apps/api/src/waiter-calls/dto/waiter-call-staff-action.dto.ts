import { IsOptional, IsUUID } from 'class-validator';

export class WaiterCallStaffActionDto {
  @IsOptional()
  @IsUUID()
  staffUserId?: string;
}
